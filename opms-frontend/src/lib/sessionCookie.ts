import { hasOpmsAccess } from "@/lib/opmsAuth";
import { resolveHomeFromUser } from "@/constants/dashboardAccess";
import { publicApiOrigin } from "@/lib/env";
import { REFRESH_EXPIRES_COOKIE } from "@session-auth/constants";
import { jwtMaxAgeSeconds } from "@session-auth/jwt";
import { isRefreshExpired, refreshCookieMaxAgeSeconds } from "@session-auth/refreshExpiry";
import {
  broadcastAuthLogout,
  isSessionTerminated,
  markSessionTerminated,
  resetSessionTerminated,
  subscribeAuthLogout,
} from "@session-auth/sessionTerminator";

/** Access JWT. Roles for routing are read from this token. */
export const ACCESS_COOKIE_NAME = "access_token";
export const REFRESH_COOKIE_NAME = "refresh_token";
export { REFRESH_EXPIRES_COOKIE };

const LEGACY_COOKIES = [
  "medica_session",
  "medica_opms_roles",
  "medica_department_hint",
  "shakti_session",
  "shakti_department",
  "shakti_roles",
];

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, maxAge: number): void {
  document.cookie = `${name}=${encodeURIComponent(
    value,
  )}; Path=/; Max-Age=${String(maxAge)}; SameSite=Lax`;
}

const ALL_SESSION_KEYS = [
  "shakti.app.session",
  "shakti.lead_manager.session",
  "medica.auth",
  "shakti.user_manager.session",
  "shakti.work_planner.session",
];

function deleteCookie(name: string): void {
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax`;
  document.cookie = `${name}=; Path=/; Max-Age=0`;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/`;
}

export function readRefreshExpiresAtFromCookies(): number | null {
  const raw = getCookie(REFRESH_EXPIRES_COOKIE);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Write access and refresh cookies. Roles stay inside the access JWT. */
export function persistSessionMarksFromAuth(input: {
  token: string | null | undefined;
  refreshToken?: string | null;
  refreshExpiresAt?: number | null;
  user: unknown;
}): void {
  if (typeof document === "undefined") return;
  if (!input.token) return;

  for (const name of LEGACY_COOKIES) deleteCookie(name);

  if (hasOpmsAccess(input.user)) {
    resetSessionTerminated();
    const accessMax = jwtMaxAgeSeconds(input.token);
    if (accessMax > 0) {
      setCookie(ACCESS_COOKIE_NAME, input.token, accessMax);
    } else {
      deleteCookie(ACCESS_COOKIE_NAME);
    }
    if (input.refreshToken) {
      const refreshMax = refreshCookieMaxAgeSeconds(input.refreshExpiresAt ?? undefined);
      setCookie(REFRESH_COOKIE_NAME, input.refreshToken, refreshMax);
      if (input.refreshExpiresAt) {
        setCookie(REFRESH_EXPIRES_COOKIE, String(input.refreshExpiresAt), refreshMax);
      } else {
        deleteCookie(REFRESH_EXPIRES_COOKIE);
      }
    }
    return;
  }

  clearSessionMarks();
}

/** Revoke this device's refresh-token family. Other devices stay signed in. */
export async function revokeRefreshToken(refreshToken?: string | null): Promise<void> {
  if (!refreshToken) return;
  try {
    await fetch(`${publicApiOrigin()}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    /* local session is still cleared by the caller */
  }
}

export function clearSessionMarks(): void {
  if (typeof document === "undefined") return;
  deleteCookie(ACCESS_COOKIE_NAME);
  deleteCookie(REFRESH_COOKIE_NAME);
  deleteCookie(REFRESH_EXPIRES_COOKIE);
  for (const name of LEGACY_COOKIES) deleteCookie(name);

  if (typeof window !== "undefined") {
    for (const key of ALL_SESSION_KEYS) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
  }
}

export function invalidateOpmsClientSession(redirectTo = "/login"): void {
  if (isSessionTerminated()) return;
  markSessionTerminated();
  broadcastAuthLogout();
  clearSessionMarks();
  if (typeof window !== "undefined" && window.location.pathname !== redirectTo) {
    window.location.assign(redirectTo);
  }
}

export { isSessionTerminated, isRefreshExpired };

/** Home path from OPMS portal roles on the user object. */
export function fallbackHomeHrefFromUser(user: unknown): string {
  return resolveHomeFromUser(user) ?? "/login";
}

if (typeof window !== "undefined") {
  subscribeAuthLogout(() => {
    if (isSessionTerminated()) return;
    markSessionTerminated();
    clearSessionMarks();
    if (window.location.pathname !== "/login") window.location.assign("/login");
  });
}
