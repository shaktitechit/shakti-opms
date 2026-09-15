"use client";

import { useEffect, useRef } from "react";

import { hasOpmsAccess } from "@/lib/opmsAuth";
import { persistSessionMarksFromAuth } from "@/lib/sessionCookie";
import {
  AUTH_STORAGE_KEY,
  setCredentials,
  type AuthUser,
} from "@/store/slices/authSlice";
import { useAppDispatch } from "@/store";

function parseJwtUser(token: string): AuthUser | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    const decoded = JSON.parse(json) as Record<string, unknown>;
    return {
      _id: String(decoded.sub || decoded._id || decoded.id || "user"),
      name: String(decoded.name || decoded.email || "User"),
      email: String(decoded.email || ""),
      department: String(decoded.department || ""),
      roles: Array.isArray(decoded.roles) ? decoded.roles : [],
      role_codes: Array.isArray(decoded.role_codes)
        ? decoded.role_codes.map(String)
        : [],
      portals: Array.isArray(decoded.portals) ? decoded.portals : [],
    };
  } catch {
    return null;
  }
}

/**
 * Consumes `?token=` SSO handoff from other micro-frontends (e.g. app-frontend).
 * Writes `medica.auth` + session role cookies so middleware and Redux both accept the user.
 */
export function AuthTokenSsoBootstrap() {
  const dispatch = useAppDispatch();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || typeof window === "undefined") return;
    ran.current = true;

    const url = new URL(window.location.href);
    const token = url.searchParams.get("token")?.trim();
    if (!token) return;

    const user = parseJwtUser(token);
    if (!user || !hasOpmsAccess(user)) return;

    dispatch(setCredentials({ token, user }));
    try {
      window.localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ token, user }),
      );
    } catch {
      /* ignore */
    }
    persistSessionMarksFromAuth({ token, user });

    url.searchParams.delete("token");
    const clean = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, document.title, clean || "/");
  }, [dispatch]);

  return null;
}
