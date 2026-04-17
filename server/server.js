/*
 * server.js
 * -----------------------------------------------------------------------
 * GigInsure Express application entry point.
 *
 * This file does five things:
 *   1. Loads environment variables from .env via the keys config.
 *   2. Connects to MongoDB using Mongoose.
 *   3. Sets up Express middleware (CORS, JSON parsing, etc.).
 *   4. Mounts all route modules under /api/<resource>.
 *   5. Starts the HTTP server and the node-cron trigger scheduler.
 *
 * HOW EXPRESS WORKS (quick refresher):
 *   - app.use(path, router) mounts a router at a URL prefix.
 *   - app.use(middleware) runs middleware for every request.
 *   - Order matters: middleware and routes are processed top-to-bottom.
 *   - The globalErrorHandler MUST be the last app.use() call because
 *     Express recognises error handlers by their 4-argument signature
 *     and only calls them when an error is passed to next(err).
 *
 * -----------------------------------------------------------------------
 */

// ---- Load environment variables ----------------------------------------
// This must be called before any module that reads process.env.
// config/keys.js calls require('dotenv').config() internally.
const { PORT } = require('./config/keys');

// ---- Core dependencies -------------------------------------------------
const express = require('express');
const cors = require('cors');

// ---- App setup ---------------------------------------------------------
const connectDB = require('./config/db');

// ---- Route modules -----------------------------------------------------
const authRoutes      = require('./routes/auth');
const premiumRoutes   = require('./routes/premium');
const policyRoutes    = require('./routes/policy');
const claimsRoutes    = require('./routes/claims');
const triggersRoutes  = require('./routes/triggers');
const paymentsRoutes  = require('./routes/payments');
const analyticsRoutes = require('./routes/analytics');
const adminRoutes          = require('./routes/admin');
const demoRoutes           = require('./routes/demo');
const eligibilityRoutes    = require('./routes/eligibility');
const eligibilityMapRoutes = require('./routes/eligibilityMap');

// ---- Middleware ---------------------------------------------------------
const globalErrorHandler = require('./middleware/errorHandler');

// ---- Scheduler ---------------------------------------------------------
const { startScheduler } = require('./services/schedulerService');

// -----------------------------------------------------------------------
// Create Express app
// -----------------------------------------------------------------------
const app = express();

// -----------------------------------------------------------------------
// Global middleware
// -----------------------------------------------------------------------

// CORS: allow all origins in dev; in production restrict to the Vercel domain.
// Set ALLOWED_ORIGIN env var on Render to your Vercel URL (e.g. https://giginsure.vercel.app).
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Parse incoming JSON request bodies. Sets req.body to the parsed object.
// The 10mb limit prevents large payload denial-of-service attacks while
// still allowing reasonable request sizes.
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded bodies (for HTML form submissions, though we primarily
// expect JSON from the mobile app).
app.use(express.urlencoded({ extended: true }));

// Request logger middleware: prints each request method + URL to the
// console so you can see API traffic during development.
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// -----------------------------------------------------------------------
// Route mounting
// -----------------------------------------------------------------------
// Convention: all routes are prefixed with /api/ to distinguish them
// from static assets or frontend routes if this server ever serves HTML.

app.use('/api/auth',      authRoutes);
app.use('/api/premium',   premiumRoutes);
app.use('/api/policy',    policyRoutes);
app.use('/api/claims',    claimsRoutes);
app.use('/api/triggers',  triggersRoutes);
app.use('/api/payments',  paymentsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin/eligibility-map', eligibilityMapRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/demo',        demoRoutes);
app.use('/api/eligibility', eligibilityRoutes);

// -----------------------------------------------------------------------
// Health check endpoints
// -----------------------------------------------------------------------
// GET /api/health — lightweight liveness check for this Node server.
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'giginsure-api',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// GET /api/health/ml — pings the Python FastAPI ML service.
// Returns 200 if reachable, 503 if not.
app.get('/api/health/ml', async (_req, res) => {
  const mlClient = require('./services/mlClient');
  try {
    const { data } = await mlClient.get('/health');
    return res.status(200).json({
      status: 'ok',
      mlService: data,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    const status = err.status === 503 ? 503 : 502;
    return res.status(status).json({
      status: 'unavailable',
      error: err.message || 'ML service unreachable',
      checkedAt: new Date().toISOString(),
    });
  }
});

// -----------------------------------------------------------------------
// 404 handler
// -----------------------------------------------------------------------
// Catches any request that didn't match a route above and returns a
// JSON 404 instead of Express's default HTML "Cannot GET /..." page.
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found. Check the API documentation for valid endpoints.',
  });
});

// -----------------------------------------------------------------------
// Global error handler (MUST be last middleware)
// -----------------------------------------------------------------------
app.use(globalErrorHandler);

// -----------------------------------------------------------------------
// Start server
// -----------------------------------------------------------------------

/**
 * bootstrap
 * Connects to MongoDB and then starts listening for HTTP requests.
 * We wrap everything in an async function so we can use await for
 * the database connection before the server accepts traffic.
 */
async function bootstrap() {
  try {
    // Connect to MongoDB first. If this fails it exits the process.
    await connectDB();

    // Start the HTTP server.
    const server = app.listen(PORT, () => {
      console.log(`GigInsure API server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Start the node-cron trigger monitor (runs every 5 minutes).
    // We start it after the DB is connected because it queries MongoDB.
    startScheduler();

    // Handle graceful shutdown: when the process receives SIGTERM
    // (from Docker, Kubernetes, PM2, etc.) close the HTTP server cleanly
    // before exiting so in-flight requests can finish.
    process.on('SIGTERM', () => {
      console.log('SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
      });
    });

    // Also handle SIGINT (Ctrl+C in the terminal during development).
    process.on('SIGINT', () => {
      console.log('SIGINT received. Shutting down...');
      server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
      });
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Run the bootstrap function.
bootstrap();
