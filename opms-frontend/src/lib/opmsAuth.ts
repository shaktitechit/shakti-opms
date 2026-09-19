/**
 * OPMS portal access helpers — mirror backend opmsAuth.middleware
 * (portal_code: opms + access_roles, not user.department).
 */

export const OPMS_PORTAL_CODE = "opms";

export const OPMS_ACCESS_ROLES = [
  "super_admin",
  "admin",
  "sales",
  "finance",
  "account",
  "dispatch",
] as const;

export type OpmsAccessRole = (typeof OPMS_ACCESS_ROLES)[number];

/** Priority for home / primary role when a user has multiple access_roles. */
export const OPMS_ROLE_PRIORITY: readonly OpmsAccessRole[] = [
  "super_admin",
  "admin",
  "finance",
  "account",
  "dispatch",
  "sales",
] as const;

export type UserPortalAccess = {
  portal_id?: string;
  portal_code?: string;
  portal?: string;
  portal_name?: string;
  access_roles?: string[];
};

export type OpmsAuthUser = {
  portals?: UserPortalAccess[];
  portal_access?: UserPortalAccess[];
  department?: string;
  [key: string]: unknown;
};

function normalizeRole(raw: unknown): string {
  if (raw == null) return "";
  const s = String(raw).trim().toLowerCase();
  if (!s || s === "null" || s === "undefined") return "";
  return s;
}

export function getOpmsPortalAccess(
  user: unknown,
): UserPortalAccess | null {
  if (!user || typeof user !== "object") return null;
  const u = user as OpmsAuthUser;
  const portals = Array.isArray(u.portals)
    ? u.portals
    : Array.isArray(u.portal_access)
      ? u.portal_access
      : [];
  return (
    portals.find(
      (p) =>
        p &&
        (p.portal_code === OPMS_PORTAL_CODE || p.portal === OPMS_PORTAL_CODE),
    ) || null
  );
}

export function getOpmsAccessRole(user: unknown): string | null {
  if (!user || typeof user !== "object") return null;
  const u = user as OpmsAuthUser & {
    access_role?: string;
    access_roles?: string[];
    role?: string;
    roles?: string[];
    role_codes?: string[];
  };

  const portalAccess = getOpmsPortalAccess(user);
  let rawRole: unknown = null;

  if (portalAccess) {
    if (Array.isArray(portalAccess.access_roles) && portalAccess.access_roles.length > 0) {
      rawRole = portalAccess.access_roles[0];
    }
  }

  if (!rawRole) {
    if (u.access_role) rawRole = u.access_role;
    else if (Array.isArray(u.access_roles) && u.access_roles.length > 0) rawRole = u.access_roles[0];
    else if (u.role) rawRole = u.role;
    else if (Array.isArray(u.roles) && u.roles.length > 0) rawRole = u.roles[0];
    else if (Array.isArray(u.role_codes) && u.role_codes.length > 0) rawRole = u.role_codes[0];
  }

  const normalized = normalizeRole(rawRole);
  return normalized || null;
}

export function getOpmsAccessRoles(user: unknown): string[] {
  const role = getOpmsAccessRole(user);
  return role ? [role] : [];
}

export function hasOpmsAccess(user: unknown): boolean {
  return Boolean(getOpmsAccessRole(user));
}

export function hasOpmsRole(user: unknown, ...roles: string[]): boolean {
  const allowed = roles.flat().map(normalizeRole).filter(Boolean);
  if (!allowed.length) return false;
  const userRole = getOpmsAccessRole(user);
  return userRole ? allowed.includes(userRole) : false;
}

export function hasAnyOpmsRole(
  user: unknown,
  roleList: string | readonly string[],
): boolean {
  const list = Array.isArray(roleList) ? roleList : [roleList];
  return hasOpmsRole(user, ...list);
}

export function primaryOpmsRole(user: unknown): string | null {
  return getOpmsAccessRole(user);
}

export function isOpmsAdmin(user: unknown): boolean {
  return hasAnyOpmsRole(user, ["admin", "super_admin"]);
}

/** Parse comma-separated roles cookie value. */
export function parseOpmsRolesCookie(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const decoded = decodeURIComponent(raw).trim().toLowerCase();
    if (!decoded) return [];
    return decoded
      .split(",")
      .map((r) => normalizeRole(r))
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function formatOpmsRolesCookie(roles: readonly string[]): string {
  return roles.map(normalizeRole).filter(Boolean).join(",");
}
