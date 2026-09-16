import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  departmentAllowsPathFromClaims,
  getDepartment,
  getRoleCodes,
  readJwtClaims,
  resolveHomeFromUser,
} from "@/constants/dashboardAccess";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function redirectUrl(request: NextRequest, targetPath: string): URL {
  const url = request.nextUrl.clone();
  const [pathOnly, ...searchParts] = targetPath.split("?");
  url.pathname = pathOnly || "/";
  url.search = searchParts.length ? `?${searchParts.join("?")}` : "";
  return url;
}

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const cookieToken =
    request.cookies.get("shakti_session")?.value ||
    request.cookies.get("medica_session")?.value;
  const urlToken = searchParams.get("token")?.trim() || "";
  const effectiveToken = cookieToken || urlToken;

  const claims = effectiveToken ? readJwtClaims(effectiveToken) : null;
  const department =
    getDepartment(claims) ||
    request.cookies.get("shakti_department")?.value ||
    "";
  const roleCodes =
    getRoleCodes(claims).length > 0
      ? getRoleCodes(claims)
      : (request.cookies.get("shakti_roles")?.value || "")
          .split(",")
          .map((r) => r.trim())
          .filter(Boolean);

  const isAuthRoute = pathname === "/" || pathname === "/login";
  const isProtectedRoute = pathname.startsWith("/dashboard");

  if (isProtectedRoute && urlToken) {
    const response = NextResponse.next();
    response.cookies.set("shakti_session", urlToken, {
      path: "/",
      maxAge: COOKIE_MAX_AGE,
      sameSite: "lax",
    });
    response.cookies.set("medica_session", urlToken, {
      path: "/",
      maxAge: COOKIE_MAX_AGE,
      sameSite: "lax",
    });
    if (department) {
      response.cookies.set("shakti_department", department, {
        path: "/",
        maxAge: COOKIE_MAX_AGE,
        sameSite: "lax",
      });
    }
    if (roleCodes.length) {
      response.cookies.set("shakti_roles", roleCodes.join(","), {
        path: "/",
        maxAge: COOKIE_MAX_AGE,
        sameSite: "lax",
      });
    }
    return response;
  }

  if (isProtectedRoute && !effectiveToken) {
    const target = request.nextUrl.clone();
    target.pathname = "/";
    target.searchParams.set("redirect", pathname);
    return NextResponse.redirect(target);
  }

  if (
    isProtectedRoute &&
    effectiveToken &&
    department &&
    pathname !== "/dashboard" &&
    !departmentAllowsPathFromClaims({ department, roleCodes, pathname })
  ) {
    const home =
      resolveHomeFromUser({
        department,
        role_codes: roleCodes,
        roles: roleCodes.length ? ["x"] : [],
      }) || `/dashboard/${department}`;
    return NextResponse.redirect(redirectUrl(request, home));
  }

  if (isAuthRoute && effectiveToken) {
    const home =
      resolveHomeFromUser({
        department,
        role_codes: roleCodes,
        roles: roleCodes.length ? ["x"] : claims?.roles || [],
      }) || (department ? `/dashboard/${department}` : "/dashboard");
    const response = NextResponse.redirect(redirectUrl(request, home));
    if (urlToken && !cookieToken) {
      response.cookies.set("shakti_session", urlToken, {
        path: "/",
        maxAge: COOKIE_MAX_AGE,
        sameSite: "lax",
      });
      response.cookies.set("medica_session", urlToken, {
        path: "/",
        maxAge: COOKIE_MAX_AGE,
        sameSite: "lax",
      });
    }
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
