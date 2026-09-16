import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const cookieToken =
    request.cookies.get("shakti_session")?.value ||
    request.cookies.get("medica_session")?.value;
  const urlToken = searchParams.get("token")?.trim() || "";
  const effectiveToken = cookieToken || urlToken;

  const isAuthRoute = pathname === "/" || pathname === "/login";
  const isProtectedRoute = pathname.startsWith("/dashboard");

  // 1. If accessing protected route with urlToken, attach cookie to response
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
    return response;
  }

  // 2. If accessing protected route without session token, redirect to login page (/)
  if (isProtectedRoute && !effectiveToken) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // 3. If authenticated user tries to access login page (/), redirect to /dashboard
  if (isAuthRoute && effectiveToken) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    const response = NextResponse.redirect(redirectUrl);
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
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static assets)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     */
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
