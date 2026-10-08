import type { AuthUser, UserPortalAccess, UserSession } from "@/types/workPlanner";
import { AUTH_SERVICE_URL } from "@/lib/env";

const SESSION_STORAGE_KEY = "shakti.work_planner.session";
const ALL_SESSION_KEYS = [
  "shakti.app.session",
  "shakti.lead_manager.session",
  "medica.auth",
  "shakti.user_manager.session",
  "shakti.work_planner.session",
];
const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";
const LEGACY_COOKIES = [
  "shakti_session",
  "medica_session",
  "shakti_department",
  "shakti_roles",
  "medica_opms_roles",
  "medica_department_hint",
];
const ALL_COOKIES = [ACCESS_COOKIE, REFRESH_COOKIE, ...LEGACY_COOKIES];

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function jwtMaxAgeSeconds(token: string): number {
  try {
    const part = token.split(".")[1];
    if (!part) return 60;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const exp = Number(JSON.parse(atob(padded)).exp);
    const left = Math.floor(exp - Date.now() / 1000);
    return left > 0 ? left : 60;
  } catch {
    return 60;
  }
}

function setCookieMaxAge(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;
  const maxAge = Math.max(1, Math.floor(maxAgeSeconds));
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; path=/; SameSite=Lax`;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  document.cookie = `${name}=; max-age=0; path=/; SameSite=Lax`;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  document.cookie = `${name}=; max-age=0; path=/`;
}

function parseJwtUser(token: string): AuthUser | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const decoded = JSON.parse(jsonPayload);
    return {
      _id: decoded._id || decoded.sub || decoded.id || "user",
      name: decoded.name || decoded.email || "User",
      email: decoded.email || "",
      department: decoded.department || "sales",
      parent_department:
        decoded.parent_department ||
        decoded.parentDepartment ||
        (typeof decoded.department === "object" ? decoded.department?.parent_department : undefined),
      roles: decoded.roles || [],
      role_codes: decoded.role_codes || [],
      portals: decoded.portals || [],
    } as any;
  } catch {
    return null;
  }
}

export function isPowerAuditUser(user: any): boolean {
  if (!user) return false;
  const uAny = user as any;
  const parentDept = String(
    uAny.parent_department ||
      uAny.parentDepartment ||
      (typeof uAny.department === "object"
        ? uAny.department?.parent_department || uAny.department?.code || uAny.department?.name
        : "") ||
      uAny.department ||
      ""
  )
    .toLowerCase()
    .trim();

  return (
    parentDept === "power_audit" ||
    parentDept === "power-audit" ||
    parentDept === "power audit" ||
    parentDept.includes("power_audit") ||
    parentDept.includes("power audit")
  );
}

export const WORK_PLANNER_ROLES = ["executive", "coordinator", "manager", "admin"] as const;
export type WorkPlannerRole = (typeof WORK_PLANNER_ROLES)[number];

export function hasWorkPlannerPortalAccess(user: AuthUser | any | null | undefined): boolean {
  if (!user) return false;
  const uAny = user as any;
  if (uAny.is_active === false || uAny.active === false) return false;

  if (uAny.wp_role) {
    const r = String(uAny.wp_role).toLowerCase().trim();
    if (WORK_PLANNER_ROLES.includes(r as WorkPlannerRole)) {
      return true;
    }
  }

  const portals = Array.isArray(user.portals)
    ? user.portals
    : Array.isArray(uAny.portal_access)
    ? uAny.portal_access
    : [];

  const wpPortal = portals.find((p: any) => {
    if (!p) return false;
    const code =
      p.portal_code ||
      p.code ||
      (typeof p.portal === "object" ? p.portal?.code || p.portal?.portal_code : p.portal);
    return String(code || "").toLowerCase().trim() === "work_planner";
  });

  if (!wpPortal) return false;

  const roles: string[] = Array.isArray(wpPortal.access_roles)
    ? wpPortal.access_roles
    : wpPortal.access_role
    ? [wpPortal.access_role]
    : Array.isArray((wpPortal as any).roles)
    ? (wpPortal as any).roles
    : [];

  const validRoles = roles
    .map((r) => String(r || "").toLowerCase().trim())
    .filter((r) => WORK_PLANNER_ROLES.includes(r as WorkPlannerRole));

  return validRoles.length > 0;
}

export function getWpAccessRoles(user: AuthUser | any | null | undefined): string[] {
  if (!user) return [];
  const uAny = user as any;
  if (uAny.is_active === false || uAny.active === false) return [];

  const portals = Array.isArray(user.portals)
    ? user.portals
    : Array.isArray(uAny.portal_access)
    ? uAny.portal_access
    : [];

  const wpPortal = portals.find((p: any) => {
    if (!p) return false;
    const code =
      p.portal_code ||
      p.code ||
      (typeof p.portal === "object" ? p.portal?.code || p.portal?.portal_code : p.portal);
    return String(code || "").toLowerCase().trim() === "work_planner";
  });

  if (!wpPortal) {
    if (uAny.wp_role) {
      const r = String(uAny.wp_role).toLowerCase().trim();
      return WORK_PLANNER_ROLES.includes(r as WorkPlannerRole) ? [r] : [];
    }
    return [];
  }

  const roles: string[] = Array.isArray(wpPortal.access_roles)
    ? wpPortal.access_roles
    : wpPortal.access_role
    ? [wpPortal.access_role]
    : Array.isArray((wpPortal as any).roles)
    ? (wpPortal as any).roles
    : [];

  return roles
    .map((r) => String(r || "").toLowerCase().trim())
    .filter((r) => WORK_PLANNER_ROLES.includes(r as WorkPlannerRole));
}

/** Portal admin role on work_planner portal only. */
export function isWpAdmin(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  return getWpAccessRoles(user).includes("admin");
}

/** Portal manager role on work_planner portal only. */
export function isWpManager(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (isWpAdmin(user)) return false;
  return getWpAccessRoles(user).includes("manager");
}

/** Portal coordinator role on work_planner portal only. */
export function isWpCoordinator(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (isWpAdmin(user) || isWpManager(user)) return false;
  return getWpAccessRoles(user).includes("coordinator");
}

/** Admin, manager, or coordinator — elevated portal actions. */
export function isWpElevated(user: AuthUser | null | undefined): boolean {
  return isWpAdmin(user) || isWpManager(user) || isWpCoordinator(user);
}

/** @deprecated Prefer isWpElevated / isWpAdmin / isWpManager / isWpCoordinator */
export function isManager(user: AuthUser | null | undefined): boolean {
  return isWpElevated(user);
}

export function isExecutive(user: AuthUser | null | undefined): boolean {
  if (!user || isWpElevated(user)) return false;
  return getWpAccessRoles(user).includes("executive");
}

export function roleLabel(user: AuthUser | null | undefined): string {
  if (isWpAdmin(user)) return "Admin";
  if (isWpManager(user)) return "Manager";
  if (isWpCoordinator(user)) return "Coordinator";
  if (isExecutive(user)) return "Executive";
  return "User";
}

export function readSessionFromStorage(): UserSession | null {
  if (typeof window === "undefined") return null;
  try {
    // 0. Check URL query token parameter (SSO handoff)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get("token");
    if (urlToken) {
      const userFromJwt = parseJwtUser(urlToken);
      if (userFromJwt && hasWorkPlannerPortalAccess(userFromJwt)) {
        const session: UserSession = {
          token: urlToken,
          user: userFromJwt,
        };
        saveSessionToStorage(session);
        window.history.replaceState({}, document.title, window.location.pathname);
        return session;
      }
    }

    const accessToken = getCookie(ACCESS_COOKIE);
    const refreshToken = getCookie(REFRESH_COOKIE) || undefined;

    if (accessToken) {
      const userFromJwt = parseJwtUser(accessToken);
      if (userFromJwt && hasWorkPlannerPortalAccess(userFromJwt)) {
        return {
          token: accessToken,
          refreshToken,
          user: userFromJwt,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function saveSessionToStorage(session: UserSession | null): void {
  if (typeof window === "undefined") return;
  if (!session) {
    for (const key of ALL_SESSION_KEYS) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
    for (const cookieName of ALL_COOKIES) {
      deleteCookie(cookieName);
    }
  } else {
    // Purge legacy localStorage session key
    try {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    if (session.token) {
      setCookieMaxAge(ACCESS_COOKIE, session.token, jwtMaxAgeSeconds(session.token));
    }
    if (session.refreshToken) {
      const refreshMax = session.refreshExpiresAt
        ? Math.floor((session.refreshExpiresAt - Date.now()) / 1000)
        : 7 * 24 * 60 * 60; // 7 days default
      setCookieMaxAge(REFRESH_COOKIE, session.refreshToken, Math.max(refreshMax, 60));
    } else {
      deleteCookie(REFRESH_COOKIE);
    }
    for (const name of LEGACY_COOKIES) deleteCookie(name);
  }
}

export async function syncSessionCookie(
  token: string,
  user: AuthUser,
  refreshToken?: string,
  refreshExpiresAt?: number,
): Promise<void> {
  saveSessionToStorage({ token, refreshToken, refreshExpiresAt, user });
}

export function clearSessionFromStorage(): void {
  saveSessionToStorage(null);
}

/** Revoke this device's refresh-token family. Other devices stay signed in. */
export async function revokeRefreshToken(refreshToken?: string | null): Promise<void> {
  if (!refreshToken) return;
  try {
    await fetch(`${AUTH_SERVICE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    /* local session is still cleared by the caller */
  }
}
