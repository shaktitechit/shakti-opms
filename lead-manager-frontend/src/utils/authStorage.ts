import type { AuthUser, UserPortalAccess, UserSession } from "@/types/leadManager";
import { AUTH_SERVICE_URL } from "@/lib/env";

const SESSION_STORAGE_KEY = "shakti.lead_manager.session";
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
      roles: decoded.roles || [],
      role_codes: decoded.role_codes || [],
      portals: decoded.portals || [],
    } as any;
  } catch {
    return null;
  }
}

export function hasLeadManagerPortalAccess(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  const uAny = user as any;
  const portals = Array.isArray(user.portals)
    ? user.portals
    : Array.isArray(uAny.portal_access)
    ? uAny.portal_access
    : [];
  const portalAccess = portals.find(
    (p: any) => p && (p.portal_code === "lead_manager" || p.portal === "lead_manager")
  );
  return Boolean(
    portalAccess &&
      Array.isArray(portalAccess.access_roles) &&
      portalAccess.access_roles.length > 0
  );
}

export function isAdmin(user: AuthUser | null | undefined): boolean {
  const uParam = user as any;
  if (!user || (!uParam?._id && !uParam?.id && !uParam?.email)) {
    const s = readSessionFromStorage();
    user = s?.user || null;
  }
  if (!user) return false;

  const uAny = user as any;
  const portals = Array.isArray(user.portals)
    ? user.portals
    : Array.isArray(uAny.portal_access)
    ? uAny.portal_access
    : [];

  const portalAccess = portals.find(
    (p: any) => p && (p.portal_code === "lead_manager" || p.portal === "lead_manager")
  );

  return Boolean(
    portalAccess &&
      Array.isArray(portalAccess.access_roles) &&
      portalAccess.access_roles.includes("admin")
  );
}

export function isManager(user: AuthUser | null | undefined): boolean {
  const uParam = user as any;
  if (!user || (!uParam?._id && !uParam?.id && !uParam?.email)) {
    const s = readSessionFromStorage();
    user = s?.user || null;
  }
  if (!user) return false;

  const uAny = user as any;
  const portals = Array.isArray(user.portals)
    ? user.portals
    : Array.isArray(uAny.portal_access)
    ? uAny.portal_access
    : [];

  const portalAccess = portals.find(
    (p: any) => p && (p.portal_code === "lead_manager" || p.portal === "lead_manager")
  );

  return Boolean(
    portalAccess &&
      Array.isArray(portalAccess.access_roles) &&
      portalAccess.access_roles.includes("manager")
  );
}

export function isExecutive(user: AuthUser | null | undefined): boolean {
  const uParam = user as any;
  if (!user || (!uParam?._id && !uParam?.id && !uParam?.email)) {
    const s = readSessionFromStorage();
    user = s?.user || null;
  }
  if (!user) return false;

  const uAny = user as any;
  const portals = Array.isArray(user.portals)
    ? user.portals
    : Array.isArray(uAny.portal_access)
    ? uAny.portal_access
    : [];

  const portalAccess = portals.find(
    (p: any) => p && (p.portal_code === "lead_manager" || p.portal === "lead_manager")
  );

  return Boolean(
    portalAccess &&
      Array.isArray(portalAccess.access_roles) &&
      portalAccess.access_roles.includes("executive")
  );
}

export function readSessionFromStorage(): UserSession | null {
  if (typeof window === "undefined") return null;
  try {
    // 0. Check URL query token parameter
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get("token");
    if (urlToken) {
      const userFromJwt = parseJwtUser(urlToken);
      if (userFromJwt && hasLeadManagerPortalAccess(userFromJwt)) {
        const session: UserSession = {
          token: urlToken,
          user: userFromJwt,
        };
        saveSessionToStorage(session);
        window.history.replaceState({}, document.title, window.location.pathname);
        return session;
      }
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
        hasLeadManagerPortalAccess(parsed.user)
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
      if (userFromJwt && hasLeadManagerPortalAccess(userFromJwt)) {
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
    setCookieMaxAge(ACCESS_COOKIE, session.token, jwtMaxAgeSeconds(session.token));
    if (session.refreshToken) {
      const refreshMax = session.refreshExpiresAt
        ? Math.floor((session.refreshExpiresAt - Date.now()) / 1000)
        : jwtMaxAgeSeconds(session.token);
      setCookieMaxAge(REFRESH_COOKIE, session.refreshToken, refreshMax);
    }
    else deleteCookie(REFRESH_COOKIE);
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
