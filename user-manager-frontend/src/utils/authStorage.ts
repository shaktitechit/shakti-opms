import type { AuthUser, UserSession } from "@/types/userManager";
import { API_BASE } from "@/utils/apiHelpers";

const SESSION_STORAGE_KEY = "shakti.user_manager.session";
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

function setCookie(name: string, value: string, days = 8 / 24) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  document.cookie = `${name}=; max-age=0; path=/; SameSite=Lax`;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  document.cookie = `${name}=; max-age=0; path=/`;
}

export function hasSuperAdminAccess(user: any): boolean {
  if (!user) return false;
  if (user.department === "super_admin" || user.department === "admin") return true;
  if (Array.isArray(user.role_codes) && (user.role_codes.includes("super_admin") || user.role_codes.includes("admin"))) return true;
  if (Array.isArray(user.roles) && (user.roles.includes("super_admin") || user.roles.includes("admin"))) return true;
  const portals = Array.isArray(user.portals) ? user.portals : (Array.isArray(user.portal_access) ? user.portal_access : []);
  const p = portals.find((x: any) => x && (x.portal_code === "user_manager" || x.portal === "user_manager"));
  if (p && Array.isArray(p.access_roles) && (p.access_roles.includes("super_admin") || p.access_roles.includes("admin"))) return true;
  return false;
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
      _id: decoded._id || decoded.id || "superadmin",
      name: decoded.name || "Super Administrator",
      email: decoded.email || "superadmin@example.com",
      department: decoded.department || "super_admin",
      roles: decoded.roles || ["super_admin"],
      role_codes: decoded.role_codes || [],
      portals: decoded.portals || [],
    } as any;
  } catch {
    return null;
  }
}

export function readSessionFromStorage(): UserSession | null {
  if (typeof window === "undefined") return null;
  try {
    // 0. Check URL query token parameter
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get("token");
    if (urlToken) {
      const userFromJwt = parseJwtUser(urlToken);
      const session: UserSession = {
        token: urlToken,
        user: userFromJwt || {
          _id: "super_admin",
          name: "Super Administrator",
          email: "superadmin@example.com",
          department: "super_admin",
        },
      };
      saveSessionToStorage(session);
      window.history.replaceState({}, document.title, window.location.pathname);
      return session;
    }

    if (!getCookie(ACCESS_COOKIE) && !getCookie(REFRESH_COOKIE)) {
      saveSessionToStorage(null);
      return null;
    }

    const accessToken = getCookie(ACCESS_COOKIE);
    const refreshToken = getCookie(REFRESH_COOKIE) || undefined;
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw && accessToken) {
      const parsed = JSON.parse(raw) as UserSession;
      if (
        parsed?.token === accessToken &&
        parsed?.user &&
        hasSuperAdminAccess(parsed.user)
      ) {
        return {
          token: parsed.token,
          refreshToken: refreshToken || parsed.refreshToken,
          user: parsed.user,
        };
      }
    }

    if (accessToken) {
      const userFromJwt = parseJwtUser(accessToken);
      if (userFromJwt && hasSuperAdminAccess(userFromJwt)) {
        const session = { token: accessToken, refreshToken, user: userFromJwt };
        window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
        return session;
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
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    setCookie(ACCESS_COOKIE, session.token);
    if (session.refreshToken) setCookie(REFRESH_COOKIE, session.refreshToken, 7);
    else deleteCookie(REFRESH_COOKIE);
    for (const name of LEGACY_COOKIES) deleteCookie(name);
  }
}

/** Revoke this device's refresh-token family. Other devices stay signed in. */
export async function revokeRefreshToken(refreshToken?: string | null): Promise<void> {
  if (!refreshToken) return;
  try {
    await fetch(`${API_BASE.replace(/\/+$/, "")}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    /* local session is still cleared by the caller */
  }
}
