/**
 * @fileoverview Middleware to validate lead_manager portal access and portal roles.
 * @module middlewares/leadManagerAuth.middleware
 */
const { ApiError } = require('../utils/ApiError');

/**
 * Admin role on lead_manager portal.
 * Returns true ONLY if assigned access_roles on lead_manager portal contains 'admin'.
 */
function isAdmin(user) {
  if (!user) return false;
  const portalAccess = Array.isArray(user.portals)
    ? user.portals.find((p) => p && (p.portal_code === 'lead_manager' || p.portal === 'lead_manager'))
    : null;
  if (portalAccess && Array.isArray(portalAccess.access_roles)) {
    return portalAccess.access_roles.includes('admin');
  }
  return false;
}

/**
 * Manager role on lead_manager portal.
 * Returns true ONLY if assigned access_roles on lead_manager portal contains 'manager'.
 */
function isManager(user) {
  if (!user) return false;
  const portalAccess = Array.isArray(user.portals)
    ? user.portals.find((p) => p && (p.portal_code === 'lead_manager' || p.portal === 'lead_manager'))
    : null;
  if (portalAccess && Array.isArray(portalAccess.access_roles)) {
    return portalAccess.access_roles.includes('manager');
  }
  return false;
}

/**
 * Executive role on lead_manager portal.
 * Returns true ONLY if assigned access_roles on lead_manager portal contains 'executive'.
 */
function isExecutive(user) {
  if (!user) return false;
  const portalAccess = Array.isArray(user.portals)
    ? user.portals.find((p) => p && (p.portal_code === 'lead_manager' || p.portal === 'lead_manager'))
    : null;
  if (portalAccess && Array.isArray(portalAccess.access_roles)) {
    return portalAccess.access_roles.includes('executive');
  }
  return false;
}

function hasPortalAccess(user, portalCode) {
  if (!user) return false;
  const portalAccess = Array.isArray(user.portals)
    ? user.portals.find((p) => p && (p.portal_code === portalCode || p.portal === portalCode))
    : null;
  return Boolean(
    portalAccess && Array.isArray(portalAccess.access_roles) && portalAccess.access_roles.length > 0
  );
}

/**
 * Validates that the user has access to lead_manager portal.
 */
function requireLeadManagerAccess(req, res, next) {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }

  if (!hasPortalAccess(req.user, 'lead_manager')) {
    return next(new ApiError(403, 'Access denied: lead_manager portal access required'));
  }
  next();
}

/**
 * Allows lead_manager or work_planner portal users (for cross-portal lead search from Work Planner).
 */
function requireLeadManagerOrWorkPlannerAccess(req, res, next) {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }

  if (hasPortalAccess(req.user, 'lead_manager') || hasPortalAccess(req.user, 'work_planner')) {
    return next();
  }

  return next(
    new ApiError(403, 'Access denied: lead_manager or work_planner portal access required')
  );
}

/**
 * Requires one of the specified portal roles ('admin', 'manager', 'executive') on lead_manager portal.
 */
function requireLeadManagerRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required'));
    }

    const portalAccess = Array.isArray(req.user.portals)
      ? req.user.portals.find((p) => p && (p.portal_code === 'lead_manager' || p.portal === 'lead_manager'))
      : null;

    if (portalAccess && Array.isArray(portalAccess.access_roles)) {
      const hasRole = allowedRoles.some((role) => portalAccess.access_roles.includes(role));
      if (hasRole) {
        return next();
      }
    }

    return next(
      new ApiError(
        403,
        `Access denied: Requires ${allowedRoles.join(' or ')} role on lead_manager portal`
      )
    );
  };
}

module.exports = {
  isAdmin,
  isManager,
  isExecutive,
  hasPortalAccess,
  requireLeadManagerAccess,
  requireLeadManagerOrWorkPlannerAccess,
  requireLeadManagerRole,
};
