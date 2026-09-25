import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  isProtectedPortalPath,
  normalizeDeepLinkPath,
  resolveHomeFromRoles,
  rolesAllowPortalPath,
} from "@/constants/dashboardAccess";
import { ACCESS_COOKIE_NAME } from "@/lib/sessionCookie";
import { getOpmsAccessRoles } from "@/lib/opmsAuth";

type IssuedSession = {
  token: string;
  refreshToken?: string;
  refreshExpiresIn?: number;
};

function jwtMaxAge(token: string): number {
  try {
    const part = token.split(".")[1];
    if (!part) return 60;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf8");
    const left = Math.floor(Number(JSON.parse(json).exp) - Date.now() / 1000);
    return left > 0 ? left : 60;
  } catch {
    return 60;
  }
}

function authServiceBase(): string {
  return (
    process.env.NEXT_PUBLIC_AUTH_ORIGIN ||
    process.env.NEXT_PUBLIC_AUTH_SERVICE_URL ||
    "http://localhost:7003"
  ).replace(/\/+$/, "");
}

async function exchangeHandoff(code: string): Promise<IssuedSession | null> {
  try {
    const res = await fetch(`${authServiceBase()}/api/auth/handoff/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      token?: string;
      refreshToken?: string;
      refreshExpiresIn?: number;
      data?: { token?: string; refreshToken?: string; refreshExpiresIn?: number };
    };
    const token = data.token || data.data?.token;
    if (!token) return null;
    return {
      token,
      refreshToken: data.refreshToken || data.data?.refreshToken,
      refreshExpiresIn: data.refreshExpiresIn || data.data?.refreshExpiresIn,
    };
  } catch {
    return null;
  }
}

function redirectDashboardLegacy(pathname: string, req: NextRequest) {
  const m = pathname.match(/^\/dashboard\/([^/]+)(\/.*)?$/);
  if (!m || !m[1]) return null;
  const target = `/${m[1]}${m[2] ?? ""}`;
  return NextResponse.redirect(new URL(target, req.url));
}

/** Decode JWT payload (routing only — no signature verify). */
function rolesFromSsoToken(token: string): string[] {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return [];
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf8");
    const decoded = JSON.parse(json) as {
      portals?: Array<{
        portal_code?: string;
        portal?: string;
        access_roles?: string[];
      }>;
    };
    return getOpmsAccessRoles({ portals: decoded.portals || [] });
  } catch {
    return [];
  }
}

function redirectReq(targetPath: string, req: NextRequest) {
  const url = req.nextUrl.clone();
  const [pathOnly, ...searchParts] = targetPath.split("?");
  url.pathname = pathOnly || "/";
  url.search = searchParts.length ? `?${searchParts.join("?")}` : "";
  return NextResponse.redirect(url);
}

const LEGACY_COOKIES = ["medica_session", "medica_opms_roles", "shakti_session", "shakti_department", "shakti_roles"];

function applySessionCookies(res: NextResponse, session?: string | IssuedSession) {
  if (!session) return;
  const token = typeof session === "string" ? session : session.token;
  const refreshToken = typeof session === "string" ? undefined : session.refreshToken;
  const refreshExpiresIn = typeof session === "string" ? undefined : session.refreshExpiresIn;
  res.cookies.set(ACCESS_COOKIE_NAME, token, {
    path: "/",
    maxAge: jwtMaxAge(token),
    sameSite: "lax",
  });
  if (refreshToken) {
    res.cookies.set("refresh_token", refreshToken, {
      path: "/",
      maxAge: refreshExpiresIn && refreshExpiresIn > 0 ? refreshExpiresIn : jwtMaxAge(token),
      sameSite: "lax",
    });
  }
  for (const name of LEGACY_COOKIES) {
    res.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const dashRedirect = redirectDashboardLegacy(pathname, req);
  if (dashRedirect) return dashRedirect;

  const handoffCode = req.nextUrl.searchParams.get("handoff")?.trim() || "";
  let exchanged: IssuedSession | null = null;
  if (handoffCode) {
    exchanged = await exchangeHandoff(handoffCode);
    if (exchanged) {
      const roles = rolesFromSsoToken(exchanged.token);
      const clean = req.nextUrl.clone();
      clean.searchParams.delete("handoff");
      clean.searchParams.delete("token");
      const isLoginRoute = pathname === "/login" || pathname === "/";
      const targetPath =
        isLoginRoute && roles.length
          ? resolveHomeFromRoles(roles) ?? "/login"
          : `${clean.pathname}${clean.search}`;
      const res = redirectReq(targetPath, req);
      applySessionCookies(res, exchanged);
      return res;
    }
  }

  const ssoToken = req.nextUrl.searchParams.get("token")?.trim() || "";
  const ssoRoles = ssoToken ? rolesFromSsoToken(ssoToken) : [];

  const isLoginRoute = pathname === "/login";
  const isRootRoute = pathname === "/";
  const accessToken = req.cookies.get(ACCESS_COOKIE_NAME)?.value?.trim() || "";
  const accessRoles = accessToken ? rolesFromSsoToken(accessToken) : [];

  const roles = ssoRoles.length ? ssoRoles : accessRoles;
  const hasRoles = roles.length > 0;
  const sessionOk = (Boolean(accessToken) && hasRoles) || ssoRoles.length > 0;

  const protectionHit = isProtectedPortalPath(pathname);

  const homeUrl = (): string =>
    hasRoles ? resolveHomeFromRoles(roles) ?? "/login" : "/login";

  const pathAllowed = (targetPath: string): boolean =>
    rolesAllowPortalPath({ pathname: targetPath, roles });

  if ((isLoginRoute || isRootRoute) && sessionOk) {
    const fromRaw = req.nextUrl.searchParams.get("from")?.trim() ?? "";
    const normalized = normalizeDeepLinkPath(fromRaw);
    const pathOnly = (normalized.split("?")[0] ?? "").trim();
    if (
      pathOnly.length > 0 &&
      pathOnly.startsWith("/") &&
      isProtectedPortalPath(pathOnly) &&
      pathAllowed(pathOnly)
    ) {
      const res = redirectReq(pathOnly, req);
      if (ssoRoles.length) applySessionCookies(res, ssoToken);
      return res;
    }
    const res = redirectReq(homeUrl(), req);
    if (ssoRoles.length) applySessionCookies(res, ssoToken);
    return res;
  }

  if (protectionHit && !sessionOk) {
    if (handoffCode) return NextResponse.next();
    const fromTarget = `${pathname}${req.nextUrl.search}`;
    const loginTarget = `/login?from=${encodeURIComponent(fromTarget)}`;
    return redirectReq(loginTarget, req);
  }

  if (protectionHit && sessionOk) {
    if (!pathAllowed(pathname)) {
      const res = redirectReq(homeUrl(), req);
      if (ssoRoles.length) applySessionCookies(res, ssoToken);
      return res;
    }
    const res = NextResponse.next();
    if (ssoRoles.length) applySessionCookies(res, ssoToken);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/dashboard/:path*",
    "/admin",
    "/admin/:path*",
    "/sales",
    "/sales/:path*",
    "/finance",
    "/finance/:path*",
    "/account",
    "/account/:path*",
    "/dispatch",
    "/dispatch/:path*",
    "/super_admin",
    "/super_admin/:path*",
  ],
};
