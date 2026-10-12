import { isRefreshExpired } from "./refreshExpiry";
import {
  isSessionTerminated,
  markSessionTerminated,
  resetSessionTerminated,
} from "./sessionTerminator";

export type RefreshedSessionPayload = {
  token: string;
  refreshToken: string;
  refreshExpiresAt: number;
  user: unknown;
};

export type CreateRefreshAccessTokenDeps = {
  authRefreshUrl: string;
  getRefreshToken: () => string | null;
  getRefreshExpiresAt: () => number | null;
  readFallbackUser: () => unknown | null;
  saveRefreshedSession: (payload: RefreshedSessionPayload) => void;
  invalidateSession: () => void;
};

function parseRefreshResponse(
  data: unknown,
  fallbackRefresh: string,
  fallbackUser: unknown | null,
): RefreshedSessionPayload | null {
  const root = data as {
    token?: string;
    refreshToken?: string;
    refreshExpiresIn?: number;
    user?: unknown;
    data?: {
      token?: string;
      refreshToken?: string;
      refreshExpiresIn?: number;
      user?: unknown;
    };
  };
  const token = root.token || root.data?.token;
  const refreshToken = root.refreshToken || root.data?.refreshToken || fallbackRefresh;
  const refreshExpiresIn = root.refreshExpiresIn || root.data?.refreshExpiresIn;
  const user = root.user ?? root.data?.user ?? fallbackUser;
  if (!token || !user) return null;
  const refreshExpiresAt = refreshExpiresIn
    ? Date.now() + refreshExpiresIn * 1000
    : Date.now() + 30 * 24 * 60 * 60 * 1000;
  return { token, refreshToken, refreshExpiresAt, user };
}

export function createRefreshAccessToken(deps: CreateRefreshAccessTokenDeps): () => Promise<boolean> {
  let refreshInFlight: Promise<boolean> | null = null;

  return async function refreshAccessToken(): Promise<boolean> {
    if (isSessionTerminated()) return false;
    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = (async () => {
      const refreshExpiresAt = deps.getRefreshExpiresAt();
      if (isRefreshExpired(refreshExpiresAt)) {
        deps.invalidateSession();
        return false;
      }

      const refreshToken = deps.getRefreshToken();
      if (!refreshToken) return false;

      try {
        const res = await fetch(deps.authRefreshUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) {
          markSessionTerminated();
          deps.invalidateSession();
          return false;
        }
        const data = await res.json();
        const payload = parseRefreshResponse(data, refreshToken, deps.readFallbackUser());
        if (!payload) {
          markSessionTerminated();
          deps.invalidateSession();
          return false;
        }
        deps.saveRefreshedSession(payload);
        resetSessionTerminated();
        return true;
      } catch {
        markSessionTerminated();
        deps.invalidateSession();
        return false;
      }
    })().finally(() => {
      refreshInFlight = null;
    });

    return refreshInFlight;
  };
}
