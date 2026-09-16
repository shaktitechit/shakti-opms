import type { AuthUser, UserPortalAccess, UserSession } from "@/types/leadManager";

const SESSION_STORAGE_KEY = "shakti.lead_manager.session";
const COOKIE_KEY = "shakti_session";
const MEDICA_COOKIE_KEY = "medica_session";

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
  if (
    uAny.department === "super_admin" ||
    uAny.department === "admin" ||
    (Array.isArray(uAny.role_codes) && (uAny.role_codes.includes("admin") || uAny.role_codes.includes("super_admin"))) ||
    (Array.isArray(uAny.roles) && (uAny.roles.includes("super_admin") || uAny.roles.includes("admin")))
  ) {
    return true;
  }
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
    (p: any) => p.portal_code === "lead_manager" || p.portal === "lead_manager"
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
    (p: any) => p.portal_code === "lead_manager" || p.portal === "lead_manager"
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

    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as UserSession;
      if (parsed?.token && parsed?.user && hasLeadManagerPortalAccess(parsed.user)) {
        setCookie(COOKIE_KEY, parsed.token);
        return parsed;
      }
    }

    const legacyRaw = window.localStorage.getItem("medica.auth");
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw);
      if (parsed?.token && parsed?.user && hasLeadManagerPortalAccess(parsed.user)) {
        const session = { token: parsed.token, user: parsed.user as AuthUser };
        saveSessionToStorage(session);
        return session;
      }
    }

    const userMgrRaw = window.localStorage.getItem("shakti.user_manager.session");
    if (userMgrRaw) {
      const parsed = JSON.parse(userMgrRaw);
      if (parsed?.token && parsed?.user && hasLeadManagerPortalAccess(parsed.user)) {
        const session = { token: parsed.token, user: parsed.user as AuthUser };
        saveSessionToStorage(session);
        return session;
      }
    }

    // Fallback check cookie
    const token = getCookie(COOKIE_KEY) || getCookie(MEDICA_COOKIE_KEY);
    if (token) {
      const userFromJwt = parseJwtUser(token);
      if (userFromJwt && hasLeadManagerPortalAccess(userFromJwt)) {
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
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    deleteCookie(COOKIE_KEY);
    deleteCookie(MEDICA_COOKIE_KEY);
  } else {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    if (session.token) {
      setCookie(COOKIE_KEY, session.token);
      setCookie(MEDICA_COOKIE_KEY, session.token);
    }
  }
}

export async function syncSessionCookie(token: string, user: AuthUser): Promise<void> {
  saveSessionToStorage({ token, user });
}

export function clearSessionFromStorage(): void {
  saveSessionToStorage(null);
}
