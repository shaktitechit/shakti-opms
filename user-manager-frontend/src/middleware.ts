import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const cookieToken = request.cookies.get("shakti_session")?.value;
  const urlToken = searchParams.get("token");
  const effectiveToken = cookieToken || urlToken;

  const isAuthRoute = pathname === "/" || pathname === "/login";
  const isProtectedRoute = pathname.startsWith("/dashboard");

  // 1. If accessing protected route with urlToken, attach cookie to response
  if (isProtectedRoute && urlToken) {
    const response = NextResponse.next();
    response.cookies.set("shakti_session", urlToken, {
      path: "/",
      sameSite: "lax",
    });
    return response;
  }

  // 2. If accessing protected route without session token, redirect to login page (/)
  if (isProtectedRoute && !effectiveToken) {
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. If authenticated user tries to access login page (/), redirect to /dashboard
  if (isAuthRoute && effectiveToken) {
    const response = NextResponse.redirect(new URL("/dashboard", request.url));
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
