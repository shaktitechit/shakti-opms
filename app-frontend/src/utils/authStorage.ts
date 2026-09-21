import type { AuthUser, UserSession } from "@/types/leadManager";
import {
  getDepartment,
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
const COOKIE_KEY = "shakti_session";
const MEDICA_COOKIE_KEY = "medica_session";
const DEPT_COOKIE = "shakti_department";
const ROLES_COOKIE = "shakti_roles";
const ALL_COOKIES = [
  COOKIE_KEY,
  MEDICA_COOKIE_KEY,
  DEPT_COOKIE,
  ROLES_COOKIE,
  "medica_opms_roles",
  "medica_department_hint",
];

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, days = 7) {
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

function writeAccessCookies(user: AuthUser) {
  const dept = getDepartment(user);
  const roles = getRoleCodes(user);
  if (dept) setCookie(DEPT_COOKIE, dept);
  else deleteCookie(DEPT_COOKIE);
  if (roles.length) setCookie(ROLES_COOKIE, roles.join(","));
  else deleteCookie(ROLES_COOKIE);
}

function clearAccessCookies() {
  deleteCookie(DEPT_COOKIE);
  deleteCookie(ROLES_COOKIE);
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

    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as UserSession;
      if (parsed?.token && parsed?.user && hasAppAccess(parsed.user)) {
        // Prefer fresh JWT claims when present
        const fromJwt = parseJwtUser(parsed.token);
        const user =
          fromJwt && hasAppAccess(fromJwt)
            ? {
                ...parsed.user,
                ...fromJwt,
                portals:
                  fromJwt.portals?.length
                    ? fromJwt.portals
                    : parsed.user.portals,
              }
            : parsed.user;
        setCookie(COOKIE_KEY, parsed.token);
        setCookie(MEDICA_COOKIE_KEY, parsed.token);
        writeAccessCookies(user);
        return { token: parsed.token, user };
      }
    }

    for (const key of LEGACY_SESSION_KEYS) {
      const legacyRaw = window.localStorage.getItem(key);
      if (!legacyRaw) continue;
      const parsed = JSON.parse(legacyRaw);
      if (parsed?.token && parsed?.user && hasAppAccess(parsed.user)) {
        const fromJwt = parseJwtUser(parsed.token);
        const user = (fromJwt && hasAppAccess(fromJwt)
          ? { ...parsed.user, ...fromJwt }
          : parsed.user) as AuthUser;
        const session = { token: parsed.token, user };
        saveSessionToStorage(session);
        return session;
      }
    }

    const token = getCookie(COOKIE_KEY) || getCookie(MEDICA_COOKIE_KEY);
    if (token) {
      const userFromJwt = parseJwtUser(token);
      if (userFromJwt && hasAppAccess(userFromJwt)) {
        const session = { token, user: userFromJwt };
        saveSessionToStorage(session);
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
    clearAccessCookies();
  } else {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    if (session.token) {
      setCookie(COOKIE_KEY, session.token);
      setCookie(MEDICA_COOKIE_KEY, session.token);
    }
    writeAccessCookies(session.user);
  }
}

export async function syncSessionCookie(token: string, user: AuthUser): Promise<void> {
  saveSessionToStorage({ token, user });
}

export function clearSessionFromStorage(): void {
  saveSessionToStorage(null);
}
