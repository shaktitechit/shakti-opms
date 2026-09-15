import type { AuthUser, UserSession } from "@/types/userManager";

const SESSION_STORAGE_KEY = "shakti.user_manager.session";
const COOKIE_KEY = "shakti_session";

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
      _id: decoded._id || decoded.id || "superadmin",
      name: decoded.name || "Super Administrator",
      email: decoded.email || "superadmin@example.com",
      department: decoded.department || "super_admin",
      roles: decoded.roles || ["super_admin"],
    } as AuthUser;
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

    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as UserSession;
      if (parsed?.token && parsed?.user && parsed.user.department === "super_admin") {
        // Ensure cookie is synced
        setCookie(COOKIE_KEY, parsed.token);
        return parsed;
      }
    }

    const legacyRaw = window.localStorage.getItem("medica.auth");
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw);
      if (parsed?.token && parsed?.user && parsed.user.department === "super_admin") {
        const session = { token: parsed.token, user: parsed.user as AuthUser };
        saveSessionToStorage(session);
        return session;
      }
    }

    // Fallback check cookie
    const token = getCookie(COOKIE_KEY);
    if (token) {
      const userFromJwt = parseJwtUser(token);
      if (userFromJwt) {
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
  } else {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    if (session.token) {
      setCookie(COOKIE_KEY, session.token);
    }
  }
}
