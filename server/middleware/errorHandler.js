/*
 * middleware/errorHandler.js
 * -----------------------------------------------------------------------
 * Global error-handling middleware for Express.
 *
 * Express has a special four-argument middleware signature (err, req, res,
 * next) that it uses exclusively for error handling. When any route calls
 * next(err) or throws inside an async handler wrapped with a try/catch that
 * calls next(err), Express skips all regular middleware and goes straight
 * to the first error handler it finds.
 *
 * We register this middleware last in server.js (after all routes) so it
 * catches any errors that bubble up. This prevents Node from crashing and
 * ensures every error returns a consistent JSON shape:
 *   { success: false, error: "...", stack: "..." }
 *
 * The stack trace is only included in development mode (NODE_ENV=development)
 * so that internal implementation details are never exposed in production.
 * -----------------------------------------------------------------------
 */

/**
 * globalErrorHandler
 * Express error-handling middleware. Must have exactly 4 parameters.
 *
 * @param {Error}                      err  - The error object that was thrown.
 * @param {import('express').Request}  req  - Incoming HTTP request.
 * @param {import('express').Response} res  - Outgoing HTTP response.
 * @param {Function}                   next - Next middleware (required by Express signature but not called).
 */
function globalErrorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Determine an appropriate HTTP status code.
  // If the error object has a statusCode property (set by route handlers),
  // use that; otherwise default to 500 Internal Server Error.
  const statusCode = err.statusCode || 500;

  // Always log the full error to the server console so developers can
  // see the stack trace in the terminal / log files.
  console.error(`[ERROR] ${req.method} ${req.originalUrl} -- ${err.message}`);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Build the response body.
  const body = {
    success: false,
    error: err.message || 'Internal server error',
  };

  // Only attach the stack trace in development to avoid leaking
  // implementation details to end users.
  if (process.env.NODE_ENV === 'development') {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
}

module.exports = globalErrorHandler;
