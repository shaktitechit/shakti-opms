import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { API_BASE } from "@/utils/apiHelpers";
import {
  readSessionFromStorage,
  saveSessionToStorage,
} from "@/utils/authStorage";
import type { UserSession } from "@/types/userManager";

const apiRoot = API_BASE.replace(/\/+$/, "");

const rawBaseQuery = fetchBaseQuery({
  baseUrl: apiRoot.endsWith("/api") ? apiRoot : `${apiRoot}/api`,
  prepareHeaders(headers) {
    const session = readSessionFromStorage();
    if (session?.token) {
      headers.set("Authorization", `Bearer ${session.token}`);
    }
    return headers;
  },
});

function requestUrl(args: string | FetchArgs): string {
  return typeof args === "string" ? args : args.url;
}

function skipRefresh(url: string): boolean {
  return url.includes("auth/login") || url.includes("auth/refresh");
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const session = readSessionFromStorage();
  if (!session?.refreshToken) return false;
  try {
    const res = await fetch(`${apiRoot}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      token?: string;
      refreshToken?: string;
      user?: UserSession["user"];
      data?: { token?: string; refreshToken?: string; user?: UserSession["user"] };
    };
    const token = data.token || data.data?.token;
    const refreshToken = data.refreshToken || data.data?.refreshToken;
    const user = data.user || data.data?.user || session.user;
    if (!token || !refreshToken || !user) return false;
    saveSessionToStorage({ token, refreshToken, user });
    return true;
  } catch {
    return false;
  }
}

function forceLogout(): void {
  saveSessionToStorage(null);
  if (typeof window !== "undefined" && window.location.pathname !== "/") {
    window.location.assign("/");
  }
}

const baseQueryWithAuth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status !== 401 || skipRefresh(requestUrl(args))) return result;

  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }
  const ok = await refreshInFlight;
  if (!ok) {
    forceLogout();
    return result;
  }
  return rawBaseQuery(args, api, extraOptions);
};

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithAuth,
  tagTypes: ["AuthSession", "CompanyInfo", "User", "Portal", "Department", "Role", "Notifications"],
  endpoints: () => ({}),
});
