/**
 * JWT authentication middleware.
 *
 * This reuses the exact token that `routes/auth.routes.js` already signs at
 * signup/login (payload `{ id, role }`, same `JWT_SECRET` fallback) and that the
 * client already attaches via the Axios `Authorization` header in AuthContext.
 * No second authentication system is introduced.
 *
 * It is applied only to the routes that opt into it — existing routes are
 * untouched and keep their current behaviour.
 */
const jwt = require('jsonwebtoken');

function getJwtSecret() {
  return process.env.JWT_SECRET || 'trackathlete_sih_secret_2026';
}

function extractBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') return null;
  return token.trim() || null;
}

function requireAuth(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    if (!payload?.id) {
      return res.status(401).json({ error: 'Invalid session. Please sign in again.' });
    }
    // The role is read from the signed token, never from the request body.
    req.auth = { id: String(payload.id), role: payload.role || null };
    return next();
  } catch (err) {
    const expired = err?.name === 'TokenExpiredError';
    return res.status(401).json({
      error: expired ? 'Your session has expired. Please sign in again.' : 'Invalid session. Please sign in again.'
    });
  }
}

module.exports = { requireAuth, extractBearerToken };
