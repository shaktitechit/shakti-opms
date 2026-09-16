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

function redirectReq(targetPath: string, req: NextRequest) {
  const url = req.nextUrl.clone();
  const [pathOnly, ...searchParts] = targetPath.split("?");
  url.pathname = pathOnly || "/";
  url.search = searchParts.length ? `?${searchParts.join("?")}` : "";
  return NextResponse.redirect(url);
}

function applySessionCookies(res: NextResponse, roles: string[], token?: string) {
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
  if (token) {
    res.cookies.set("shakti_session", token, {
      path: "/",
      maxAge: COOKIE_MAX_AGE,
      sameSite: "lax",
    });
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const dashRedirect = redirectDashboardLegacy(pathname, req);
  if (dashRedirect) return dashRedirect;

  const ssoToken = req.nextUrl.searchParams.get("token")?.trim() || "";
  const ssoRoles = ssoToken ? rolesFromSsoToken(ssoToken) : [];

  const isLoginRoute = pathname === "/login";
  const isRootRoute = pathname === "/";
  const hasSession = req.cookies.get(SESSION_COOKIE_NAME)?.value === "1";

  const rolesFromCookie = parseOpmsRolesCookie(
    req.cookies.get(OPMS_ROLES_COOKIE_NAME)?.value,
  );

  const shaktiToken = req.cookies.get("shakti_session")?.value?.trim() || "";
  const shaktiRoles = (!rolesFromCookie.length && shaktiToken) ? rolesFromSsoToken(shaktiToken) : [];

  const roles = ssoRoles.length ? ssoRoles : (rolesFromCookie.length ? rolesFromCookie : shaktiRoles);
  const hasRoles = roles.length > 0;
  const sessionOk = (hasSession && hasRoles) || ssoRoles.length > 0 || (Boolean(shaktiToken) && hasRoles);

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
      if (ssoRoles.length) applySessionCookies(res, ssoRoles, ssoToken);
      return res;
    }
    const res = redirectReq(homeUrl(), req);
    if (ssoRoles.length) applySessionCookies(res, ssoRoles, ssoToken);
    return res;
  }

  if (protectionHit && !sessionOk) {
    const fromTarget = `${pathname}${req.nextUrl.search}`;
    const loginTarget = `/login?from=${encodeURIComponent(fromTarget)}`;
    return redirectReq(loginTarget, req);
  }

  if (protectionHit && sessionOk) {
    if (!pathAllowed(pathname)) {
      const res = redirectReq(homeUrl(), req);
      if (ssoRoles.length) applySessionCookies(res, ssoRoles, ssoToken);
      return res;
    }
    const res = NextResponse.next();
    if (ssoRoles.length) applySessionCookies(res, ssoRoles, ssoToken);
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
