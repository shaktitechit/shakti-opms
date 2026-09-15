import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  departmentAllowsPathFromClaims,
  getDepartment,
  getRoleCodes,
  readJwtClaims,
  resolveHomeFromUser,
} from "@/constants/dashboardAccess";

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const cookieToken = request.cookies.get("shakti_session")?.value;
  const urlToken = searchParams.get("token");
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
      sameSite: "lax",
    });
    if (department) {
      response.cookies.set("shakti_department", department, {
        path: "/",
        sameSite: "lax",
      });
    }
    if (roleCodes.length) {
      response.cookies.set("shakti_roles", roleCodes.join(","), {
        path: "/",
        sameSite: "lax",
      });
    }
    return response;
  }

  if (isProtectedRoute && !effectiveToken) {
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
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
    return NextResponse.redirect(new URL(home, request.url));
  }

  if (isAuthRoute && effectiveToken) {
    const home =
      resolveHomeFromUser({
        department,
        role_codes: roleCodes,
        roles: roleCodes.length ? ["x"] : claims?.roles || [],
      }) || (department ? `/dashboard/${department}` : "/dashboard");
    const response = NextResponse.redirect(new URL(home, request.url));
    if (urlToken && !cookieToken) {
      response.cookies.set("shakti_session", urlToken, {
        path: "/",
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
