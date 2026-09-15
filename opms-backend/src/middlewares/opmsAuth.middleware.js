/**
 * @fileoverview Middleware + helpers for OPMS portal access (portal_code: opms).
 * Mirrors lead-manager portal gating: access_roles on portals[], not user.department.
 * @module middlewares/opmsAuth.middleware
 */
const { ApiError } = require('../utils/ApiError');
const ROLES = require('../constants/roles');

const OPMS_PORTAL_CODE = 'opms';

const OPMS_ACCESS_ROLES = Object.freeze([
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.SALES,
  ROLES.FINANCE,
  ROLES.ACCOUNT,
  ROLES.DISPATCH,
]);

/** Priority for audit/actor fields when a user has multiple access_roles. */
const OPMS_ROLE_PRIORITY = Object.freeze([
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.FINANCE,
  ROLES.ACCOUNT,
  ROLES.DISPATCH,
  ROLES.SALES,
]);

function getOpmsPortalAccess(user) {
  if (!user) return null;
  const portals = Array.isArray(user.portals)
    ? user.portals
    : Array.isArray(user.portal_access)
      ? user.portal_access
      : [];
  return (
    portals.find(
      (p) => p && (p.portal_code === OPMS_PORTAL_CODE || p.portal === OPMS_PORTAL_CODE)
    ) || null
  );
}

function getOpmsAccessRoles(user) {
  const portalAccess = getOpmsPortalAccess(user);
  if (!portalAccess || !Array.isArray(portalAccess.access_roles)) return [];
  return portalAccess.access_roles
    .map((r) => String(r || '').trim().toLowerCase())
    .filter(Boolean);
}

function hasOpmsAccess(user) {
  return getOpmsAccessRoles(user).length > 0;
}

function hasOpmsRole(user, ...roles) {
  const allowed = roles.flat().map((r) => String(r || '').trim().toLowerCase()).filter(Boolean);
  if (!allowed.length) return false;
  const userRoles = getOpmsAccessRoles(user);
  return allowed.some((role) => userRoles.includes(role));
}

function hasAnyOpmsRole(user, roleList) {
  const list = Array.isArray(roleList) ? roleList : [roleList];
  return hasOpmsRole(user, ...list);
}

/**
 * Single role string for workflow/flag actor metadata.
 * Priority: super_admin > admin > finance > account > dispatch > sales.
 */
function primaryOpmsRole(user) {
  const roles = getOpmsAccessRoles(user);
  if (!roles.length) return null;
  for (const preferred of OPMS_ROLE_PRIORITY) {
    if (roles.includes(preferred)) return preferred;
  }
  return roles[0];
}

function isOpmsAdmin(user) {
  return hasAnyOpmsRole(user, [ROLES.ADMIN, ROLES.SUPER_ADMIN]);
}

function requireOpmsAccess(req, res, next) {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }
  if (!hasOpmsAccess(req.user)) {
    return next(new ApiError(403, 'Access denied: opms portal access required'));
  }
  next();
}

function requireOpmsRole(...allowedRoles) {
  const flat = allowedRoles.flat();
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required'));
    }
    if (!hasOpmsAccess(req.user)) {
      return next(new ApiError(403, 'Access denied: opms portal access required'));
    }
    // admin / super_admin bypass for role-scoped routes (matches prior department policy)
    if (isOpmsAdmin(req.user)) {
      return next();
    }
    if (hasAnyOpmsRole(req.user, flat)) {
      return next();
    }
    return next(
      new ApiError(
        403,
        `Access denied: Requires ${flat.join(' or ')} role on opms portal`
      )
    );
  };
}

module.exports = {
  OPMS_PORTAL_CODE,
  OPMS_ACCESS_ROLES,
  OPMS_ROLE_PRIORITY,
  getOpmsPortalAccess,
  getOpmsAccessRoles,
  hasOpmsAccess,
  hasOpmsRole,
  hasAnyOpmsRole,
  primaryOpmsRole,
  isOpmsAdmin,
  requireOpmsAccess,
  requireOpmsRole,
};
