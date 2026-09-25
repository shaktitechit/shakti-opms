import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
    const json = Buffer.from(padded, "base64").toString("utf8");
    const left = Math.floor(Number(JSON.parse(json).exp) - Date.now() / 1000);
    return left > 0 ? left : 60;
  } catch {
    return 60;
  }
}

function authServiceBase(): string {
  return (
    process.env.NEXT_PUBLIC_AUTH_SERVICE_URL ||
    process.env.AUTH_SERVICE_URL ||
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

function applySessionCookies(response: NextResponse, session: string | IssuedSession) {
  const token = typeof session === "string" ? session : session.token;
  const refreshToken = typeof session === "string" ? undefined : session.refreshToken;
  const refreshExpiresIn = typeof session === "string" ? undefined : session.refreshExpiresIn;
  response.cookies.set("access_token", token, {
    path: "/",
    maxAge: jwtMaxAge(token),
    sameSite: "lax",
  });
  if (refreshToken) {
    response.cookies.set("refresh_token", refreshToken, {
      path: "/",
      maxAge: refreshExpiresIn && refreshExpiresIn > 0 ? refreshExpiresIn : jwtMaxAge(token),
      sameSite: "lax",
    });
  }
  for (const name of ["shakti_session", "medica_session", "shakti_department", "shakti_roles"]) {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const cookieToken = request.cookies.get("access_token")?.value;
  const urlToken = searchParams.get("token")?.trim() || "";
  const handoffCode = searchParams.get("handoff")?.trim() || "";

  let exchanged: IssuedSession | null = null;
  if (handoffCode) {
    exchanged = await exchangeHandoff(handoffCode);
  }
  const exchangedToken = exchanged?.token || null;

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
    applySessionCookies(response, exchanged || exchangedToken!);
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
      applySessionCookies(response, exchanged || urlToken || exchangedToken!);
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
