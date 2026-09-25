import { hasOpmsAccess } from "@/lib/opmsAuth";
import { resolveHomeFromUser } from "@/constants/dashboardAccess";
import { publicApiOrigin } from "@/lib/env";

/** Access JWT. Roles for routing are read from this token. */
export const ACCESS_COOKIE_NAME = "access_token";
export const REFRESH_COOKIE_NAME = "refresh_token";
const LEGACY_COOKIES = [
  "medica_session",
  "medica_opms_roles",
  "medica_department_hint",
  "shakti_session",
  "shakti_department",
  "shakti_roles",
];

const ACCESS_MAX_AGE_SECONDS = 60 * 60 * 8;
const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

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

/** Write access and refresh cookies. Roles stay inside the access JWT. */
export function persistSessionMarksFromAuth(input: {
  token: string | null | undefined;
  refreshToken?: string | null;
  user: unknown;
}): void {
  if (typeof document === "undefined") return;

  for (const name of LEGACY_COOKIES) deleteCookie(name);

  if (input.token && hasOpmsAccess(input.user)) {
    setCookie(ACCESS_COOKIE_NAME, input.token, ACCESS_MAX_AGE_SECONDS);
    if (input.refreshToken) {
      setCookie(REFRESH_COOKIE_NAME, input.refreshToken, REFRESH_MAX_AGE_SECONDS);
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

/** Home path from OPMS portal roles on the user object. */
export function fallbackHomeHrefFromUser(user: unknown): string {
  return resolveHomeFromUser(user) ?? "/login";
}
