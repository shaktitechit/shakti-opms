"use client";

import { useEffect } from "react";

import { persistSessionMarksFromAuth } from "@/lib/sessionCookie";
import { useAppSelector } from "@/store";

/** Keeps OPMS roles/session sentinel cookies in sync whenever Redux auth changes (login, me, hydration). */
export function SessionCookieSync() {
  const token = useAppSelector((s) => s.auth.token);
  const refreshToken = useAppSelector((s) => s.auth.refreshToken);
  const user = useAppSelector((s) => s.auth.user);

  useEffect(() => {
    persistSessionMarksFromAuth({ token, refreshToken, user });
  }, [token, refreshToken, user]);

  return null;
}
