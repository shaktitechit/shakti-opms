import {
  formatOpmsRolesCookie,
  getOpmsAccessRoles,
  hasOpmsAccess,
} from "@/lib/opmsAuth";
import { resolveHomeFromUser } from "@/constants/dashboardAccess";

/** Non-HttpOnly: lets Edge middleware route without JWT in LS. Cleared together with Redux logout. */
export const SESSION_COOKIE_NAME = "medica_session";
export const SHAKTI_SESSION_COOKIE_NAME = "shakti_session";
/** Comma-separated OPMS access_roles for Edge path allowlists. */
export const OPMS_ROLES_COOKIE_NAME = "medica_opms_roles";
/** @deprecated Cleared on persist; replaced by {@link OPMS_ROLES_COOKIE_NAME}. */
export const DEPT_HINT_COOKIE_NAME = "medica_department_hint";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

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

/** Sync minimal session markers after login/me so middleware can authorize navigations. */
export function persistSessionMarksFromAuth(input: {
  token: string | null | undefined;
  user: unknown;
}): void {
  if (typeof document === "undefined") return;

  // Always drop legacy dept hint.
  deleteCookie(DEPT_HINT_COOKIE_NAME);

  if (input.token && hasOpmsAccess(input.user)) {
    const roles = getOpmsAccessRoles(input.user);
    setCookie(SESSION_COOKIE_NAME, "1", COOKIE_MAX_AGE_SECONDS);
    setCookie(
      OPMS_ROLES_COOKIE_NAME,
      formatOpmsRolesCookie(roles),
      COOKIE_MAX_AGE_SECONDS,
    );
    setCookie(SHAKTI_SESSION_COOKIE_NAME, input.token, COOKIE_MAX_AGE_SECONDS);
    return;
  }

  clearSessionMarks();
}

export function clearSessionMarks(): void {
  if (typeof document === "undefined") return;
  deleteCookie(SESSION_COOKIE_NAME);
  deleteCookie(OPMS_ROLES_COOKIE_NAME);
  deleteCookie(DEPT_HINT_COOKIE_NAME);
  deleteCookie(SHAKTI_SESSION_COOKIE_NAME);
  deleteCookie("shakti_department");
  deleteCookie("shakti_roles");

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
