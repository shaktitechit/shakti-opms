import type { AuthUser, UserSession } from "@/types/leadManager";
import { AUTH_SERVICE_URL } from "@/lib/env";
import {
  getRoleCodes,
  hasDepartmentRoleAccess,
  readJwtClaims,
} from "@/constants/dashboardAccess";

const SESSION_STORAGE_KEY = "shakti.app.session";
const LEGACY_SESSION_KEYS = [
  "shakti.lead_manager.session",
  "medica.auth",
  "shakti.user_manager.session",
  "shakti.work_planner.session",
];
const ALL_SESSION_KEYS = [
  SESSION_STORAGE_KEY,
  ...LEGACY_SESSION_KEYS,
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

function writeSessionCookies(session: UserSession) {
  if (session.token) {
    setCookieMaxAge(ACCESS_COOKIE, session.token, jwtMaxAgeSeconds(session.token));
  }
  if (session.refreshToken) {
    const refreshMax = session.refreshExpiresAt
      ? Math.floor((session.refreshExpiresAt - Date.now()) / 1000)
      : 30 * 24 * 60 * 60; // 30 days default
    setCookieMaxAge(REFRESH_COOKIE, session.refreshToken, Math.max(refreshMax, 60));
  } else deleteCookie(REFRESH_COOKIE);
  for (const name of LEGACY_COOKIES) deleteCookie(name);
}

function hasSessionCookie(): boolean {
  return Boolean(getCookie(ACCESS_COOKIE) || getCookie(REFRESH_COOKIE));
}

function parseJwtUser(token: string): AuthUser | null {
  const claims = readJwtClaims(token);
  if (!claims) return null;
  const portals = Array.isArray(claims.portals)
    ? (claims.portals as AuthUser["portals"])
    : [];
  return {
    _id: String(claims.sub || "user"),
    name: claims.name || claims.email || "User",
    email: claims.email || "",
    department: claims.department || "",
    roles: Array.isArray(claims.roles) ? claims.roles.map(String) : [],
    role_codes: getRoleCodes(claims),
    portals,
  };
}

/** @deprecated Prefer {@link hasDepartmentRoleAccess}. */
export function hasLeadManagerPortalAccess(
  user: AuthUser | null | undefined,
): boolean {
  return hasDepartmentRoleAccess(user);
}

export function hasAppAccess(user: AuthUser | null | undefined): boolean {
  return hasDepartmentRoleAccess(user);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  const cookieVal = getCookie(REFRESH_COOKIE);
  if (cookieVal) return cookieVal;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.refreshToken) return parsed.refreshToken;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function readSessionFromStorage(): UserSession | null {
  if (typeof window === "undefined") return null;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get("token");
    if (urlToken) {
      const userFromJwt = parseJwtUser(urlToken);
      if (userFromJwt && hasAppAccess(userFromJwt)) {
        const session: UserSession = { token: urlToken, user: userFromJwt };
        saveSessionToStorage(session);
        window.history.replaceState({}, document.title, window.location.pathname);
        return session;
      }
    }

    const accessToken = getCookie(ACCESS_COOKIE);
    const refreshToken = getRefreshToken() || undefined;

    let storedSession: UserSession | null = null;
    try {
      const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (raw) storedSession = JSON.parse(raw);
    } catch {
      /* ignore */
    }

    if (accessToken) {
      const userFromJwt = parseJwtUser(accessToken);
      if (userFromJwt && hasAppAccess(userFromJwt)) {
        return {
          token: accessToken,
          refreshToken: refreshToken || storedSession?.refreshToken,
          refreshExpiresAt: storedSession?.refreshExpiresAt,
          user: userFromJwt,
        };
      }
    }

    if (storedSession && (refreshToken || storedSession.refreshToken)) {
      return {
        token: storedSession.token || "",
        refreshToken: refreshToken || storedSession.refreshToken,
        refreshExpiresAt: storedSession.refreshExpiresAt,
        user: storedSession.user,
      };
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
    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      /* ignore */
    }
    writeSessionCookies(session);
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
