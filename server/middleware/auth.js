/*
 * middleware/auth.js
 * -----------------------------------------------------------------------
 * JWT authentication middleware.
 *
 * In Express a "middleware" is a function that runs between the request
 * arriving and the route handler being called. It receives (req, res, next)
 * and either:
 *   - calls next() to pass control to the next middleware / route handler, OR
 *   - sends a response itself (e.g. a 401 error) to stop the chain.
 *
 * This middleware:
 *   1. Reads the Authorization header from the incoming request.
 *   2. Extracts the JWT token (expected format: "Bearer <token>").
 *   3. Verifies the token's signature using JWT_SECRET.
 *   4. If valid, attaches the decoded payload to req.user and calls next().
 *   5. If invalid / missing, returns a 401 Unauthorized JSON response.
 *
 * Usage in routes:
 *   const auth = require('../middleware/auth');
 *   router.get('/protected', auth, (req, res) => { ... });
 *
 * After the middleware runs, req.user will contain:
 *   { id: <workerId>, phone: <phone>, iat: <issued at>, exp: <expiry> }
 * -----------------------------------------------------------------------
 */

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/keys');

/**
 * verifyToken
 * Express middleware that verifies a Bearer JWT in the Authorization header.
 *
 * @param {import('express').Request}  req  - Incoming HTTP request.
 * @param {import('express').Response} res  - Outgoing HTTP response.
 * @param {Function}                   next - Calls the next middleware/handler.
 */
function verifyToken(req, res, next) {
  // Read the Authorization header value (e.g. "Bearer eyJhbGci...").
  const authHeader = req.headers['authorization'];

  // If the header is missing entirely, reject immediately.
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: 'Access denied. No Authorization header provided.',
    });
  }

  // The expected format is "Bearer <token>". Split on the space and take
  // the second part. Splitting "Bearer abc" gives ["Bearer", "abc"].
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      success: false,
      error: 'Authorization header format must be: Bearer <token>',
    });
  }

  const token = parts[1];

  try {
    // jwt.verify checks:
    //   a) the signature (was it signed with our JWT_SECRET?)
    //   b) the expiry (has `exp` passed?)
    // If either check fails it throws an error caught below.
    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach the decoded payload to the request object so downstream
    // route handlers can read req.user.id to know which worker is calling.
    req.user = decoded;

    // Hand control to the next function in the middleware chain.
    next();
  } catch (err) {
    // jwt.verify throws JsonWebTokenError for bad signatures and
    // TokenExpiredError for expired tokens. Both translate to 401.
    return res.status(401).json({
      success: false,
      error: 'Token is invalid or has expired. Please log in again.',
    });
  }
}

module.exports = verifyToken;
