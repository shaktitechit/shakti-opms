import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Aligned with default JWT_EXPIRES_IN=8h */
const COOKIE_MAX_AGE = 60 * 60 * 8;

function authServiceBase(): string {
  return (
    process.env.NEXT_PUBLIC_AUTH_SERVICE_URL ||
    process.env.AUTH_SERVICE_URL ||
    "http://localhost:7003"
  ).replace(/\/+$/, "");
}

async function exchangeHandoff(code: string): Promise<string | null> {
  try {
    const res = await fetch(`${authServiceBase()}/api/auth/handoff/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      token?: string;
      data?: { token?: string };
    };
    return data.token || data.data?.token || null;
  } catch {
    return null;
  }
}

function applySessionCookies(response: NextResponse, token: string) {
  response.cookies.set("shakti_session", token, {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  response.cookies.set("medica_session", token, {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
  });
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const cookieToken =
    request.cookies.get("shakti_session")?.value ||
    request.cookies.get("medica_session")?.value;
  const urlToken = searchParams.get("token")?.trim() || "";
  const handoffCode = searchParams.get("handoff")?.trim() || "";

  let exchangedToken: string | null = null;
  if (handoffCode) {
    exchangedToken = await exchangeHandoff(handoffCode);
  }

  const effectiveToken = cookieToken || exchangedToken || urlToken;

  const isAuthRoute = pathname === "/" || pathname === "/login";
  const isProtectedRoute = pathname.startsWith("/dashboard");

  if (exchangedToken) {
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.searchParams.delete("handoff");
    cleanUrl.searchParams.delete("token");
    const response = isAuthRoute
      ? NextResponse.redirect(
          (() => {
            const u = request.nextUrl.clone();
            u.pathname = "/dashboard";
            u.search = "";
            return u;
          })(),
        )
      : NextResponse.redirect(cleanUrl);
    applySessionCookies(response, exchangedToken);
    return response;
  }

  if (isProtectedRoute && urlToken) {
    const response = NextResponse.next();
    applySessionCookies(response, urlToken);
    return response;
  }

  if (isProtectedRoute && !effectiveToken) {
    // Allow pending client-side handoff exchange if middleware could not reach auth
    if (handoffCode) return NextResponse.next();
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isAuthRoute && effectiveToken) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    const response = NextResponse.redirect(redirectUrl);
    if ((urlToken || exchangedToken) && !cookieToken) {
      applySessionCookies(response, urlToken || exchangedToken!);
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
