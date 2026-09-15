const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const { ApiError } = require('../utils/ApiError');
const { loadUserForJwtSub } = require('../modules/auth/mongoUserBridge');

/**
 * Verifies JWT, then loads the live user from Mongo (department / roles / portals).
 * JWT claims alone are not treated as the source of truth.
 */
async function authMiddleware(req, res, next) {
  req.user = null;
  let rawToken = null;
  const h = req.headers.authorization;
  if (h && h.startsWith('Bearer ')) {
    rawToken = h.slice(7);
  } else if (typeof req.query?.token === 'string' && req.query.token.trim()) {
    rawToken = req.query.token.trim();
  }

  if (!rawToken) return next();

  try {
    const payload = jwt.verify(rawToken, JWT_SECRET);
    const sub = payload.sub || payload._id;
    if (!sub) return next();

    const user = await loadUserForJwtSub(sub);
    if (user) {
      req.user = user;
      return next();
    }

    // Token valid but user missing/inactive — do not invent identity from claims
    return next();
  } catch (_e) {
    return next();
  }
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }
  next();
}

function requirePermissions(...requiredOneOf) {
  return requireAuth;
}

module.exports = {
  authMiddleware,
  requireAuth,
  requirePermissions,
};
