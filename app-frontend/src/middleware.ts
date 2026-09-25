import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  departmentAllowsPathFromClaims,
  getDepartment,
  getRoleCodes,
  readJwtClaims,
  resolveHomeFromUser,
} from "@/constants/dashboardAccess";

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

function redirectUrl(request: NextRequest, targetPath: string): URL {
  const url = request.nextUrl.clone();
  const [pathOnly, ...searchParts] = targetPath.split("?");
  url.pathname = pathOnly || "/";
  url.search = searchParts.length ? `?${searchParts.join("?")}` : "";
  return url;
}

const LEGACY_COOKIES = ["shakti_session", "medica_session", "shakti_department", "shakti_roles"];

function applySessionCookies(response: NextResponse, token: string) {
  response.cookies.set("access_token", token, {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  for (const name of LEGACY_COOKIES) {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const cookieToken = request.cookies.get("access_token")?.value;
  const urlToken = searchParams.get("token")?.trim() || "";
  const handoffCode = searchParams.get("handoff")?.trim() || "";

  let exchangedToken: string | null = null;
  if (handoffCode) {
    exchangedToken = await exchangeHandoff(handoffCode);
  }

  const effectiveToken = cookieToken || exchangedToken || urlToken;

  const claims = effectiveToken ? readJwtClaims(effectiveToken) : null;
  const department = getDepartment(claims) || "";
  const roleCodes = getRoleCodes(claims);

  const isAuthRoute = pathname === "/" || pathname === "/login";
  const isProtectedRoute = pathname.startsWith("/dashboard");

  if (exchangedToken) {
    const home =
      resolveHomeFromUser({
        department,
        role_codes: roleCodes,
        roles: roleCodes.length ? ["x"] : claims?.roles || [],
      }) || (department ? `/dashboard/${department}` : "/dashboard");
    const clean = request.nextUrl.clone();
    clean.searchParams.delete("handoff");
    clean.searchParams.delete("token");
    const target = isAuthRoute ? home : `${clean.pathname}${clean.search}`;
    const response = NextResponse.redirect(redirectUrl(request, target));
    applySessionCookies(response, exchangedToken);
    return response;
  }

  if (isProtectedRoute && urlToken) {
    const response = NextResponse.next();
    applySessionCookies(response, urlToken);
    return response;
  }

  if (isProtectedRoute && !effectiveToken) {
    if (handoffCode) return NextResponse.next();
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
      applySessionCookies(response, urlToken);
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
