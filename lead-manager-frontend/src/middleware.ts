import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const cookieToken = request.cookies.get("shakti_session")?.value;
  const urlToken = searchParams.get("token");
  const effectiveToken = cookieToken || urlToken;

  const isAuthRoute = pathname === "/" || pathname === "/login";
  const isProtectedRoute = pathname.startsWith("/dashboard");

  if (isProtectedRoute && urlToken) {
    const response = NextResponse.next();
    response.cookies.set("shakti_session", urlToken, {
      path: "/",
      sameSite: "lax",
    });
    return response;
  }

  if (isProtectedRoute && !effectiveToken) {
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

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
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
