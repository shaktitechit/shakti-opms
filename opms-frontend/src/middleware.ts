import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  isProtectedPortalPath,
  normalizeDeepLinkPath,
  resolveHomeFromRoles,
  rolesAllowPortalPath,
} from "@/constants/dashboardAccess";
import {
  OPMS_ROLES_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "@/lib/sessionCookie";
import {
  formatOpmsRolesCookie,
  getOpmsAccessRoles,
  parseOpmsRolesCookie,
} from "@/lib/opmsAuth";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

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

function applySessionCookies(res: NextResponse, roles: string[]) {
  if (!roles.length) return;
  res.cookies.set(SESSION_COOKIE_NAME, "1", {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  res.cookies.set(OPMS_ROLES_COOKIE_NAME, formatOpmsRolesCookie(roles), {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
  });
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const dashRedirect = redirectDashboardLegacy(pathname, req);
  if (dashRedirect) return dashRedirect;

  const ssoToken = req.nextUrl.searchParams.get("token")?.trim() || "";
  const ssoRoles = ssoToken ? rolesFromSsoToken(ssoToken) : [];

  const isLoginRoute = pathname === "/login";
  const hasSession = req.cookies.get(SESSION_COOKIE_NAME)?.value === "1";

  const rolesFromCookie = parseOpmsRolesCookie(
    req.cookies.get(OPMS_ROLES_COOKIE_NAME)?.value,
  );
  const roles = ssoRoles.length ? ssoRoles : rolesFromCookie;
  const hasRoles = roles.length > 0;
  const sessionOk = (hasSession && hasRoles) || ssoRoles.length > 0;

  const protectionHit = isProtectedPortalPath(pathname);

  const homeUrl = (): string =>
    hasRoles ? resolveHomeFromRoles(roles) ?? "/login" : "/login";

  const pathAllowed = (targetPath: string): boolean =>
    rolesAllowPortalPath({ pathname: targetPath, roles });

  if (isLoginRoute && sessionOk) {
    const fromRaw = req.nextUrl.searchParams.get("from")?.trim() ?? "";
    const normalized = normalizeDeepLinkPath(fromRaw);
    const pathOnly = (normalized.split("?")[0] ?? "").trim();
    if (
      pathOnly.length > 0 &&
      pathOnly.startsWith("/") &&
      isProtectedPortalPath(pathOnly) &&
      pathAllowed(pathOnly)
    ) {
      const res = NextResponse.redirect(new URL(pathOnly, req.url));
      if (ssoRoles.length) applySessionCookies(res, ssoRoles);
      return res;
    }
    const res = NextResponse.redirect(new URL(homeUrl(), req.url));
    if (ssoRoles.length) applySessionCookies(res, ssoRoles);
    return res;
  }

  if (protectionHit && !sessionOk) {
    const login = new URL("/login", req.url);
    login.searchParams.set("from", `${pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(login);
  }

  if (protectionHit && sessionOk) {
    if (!pathAllowed(pathname)) {
      const res = NextResponse.redirect(new URL(homeUrl(), req.url));
      if (ssoRoles.length) applySessionCookies(res, ssoRoles);
      return res;
    }
    const res = NextResponse.next();
    if (ssoRoles.length) applySessionCookies(res, ssoRoles);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
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
