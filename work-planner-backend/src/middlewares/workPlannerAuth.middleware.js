/**
 * @fileoverview Middleware to validate work_planner portal access and portal roles.
 * @module middlewares/workPlannerAuth.middleware
 */
const { ApiError } = require('../utils/ApiError');
const {
  isManager,
  isExecutive,
  isWpAdmin,
  isWpManager,
  isWpElevated,
  isSuperAdminBypass,
  getWorkPlannerAccessRoles,
} = require('../modules/workPlanner/workPlanner.constants');

/**
 * Validates that the user has access to work_planner portal.
 */
function requireWorkPlannerAccess(req, res, next) {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }
  if (isSuperAdminBypass(req.user)) {
    return next();
  }
  const portalAccess = Array.isArray(req.user.portals)
    ? req.user.portals.find((p) => p.portal_code === 'work_planner')
    : null;

  if (!portalAccess || !Array.isArray(portalAccess.access_roles) || portalAccess.access_roles.length === 0) {
    return next(new ApiError(403, 'Access denied: work_planner portal access required'));
  }
  next();
}

/**
 * Requires one of the specified portal roles (e.g. 'manager', 'admin') on work_planner portal.
 * Super-admin bypass always allowed.
 */
function requireWorkPlannerRole(...allowedRoles) {
  const allowed = allowedRoles.map((r) => String(r).toLowerCase());
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required'));
    }
    if (isSuperAdminBypass(req.user)) {
      return next();
    }

    const portalRoles = getWorkPlannerAccessRoles(req.user);
    const hasRole = allowed.some((role) => portalRoles.includes(role));
    if (hasRole) {
      return next();
    }

    return next(
      new ApiError(
        403,
        `Access denied: Requires ${allowedRoles.join(' or ')} role on work_planner portal`
      )
    );
  };
}

module.exports = {
  isManager,
  isExecutive,
  isWpAdmin,
  isWpManager,
  isWpElevated,
  requireWorkPlannerAccess,
  requireWorkPlannerRole,
};
