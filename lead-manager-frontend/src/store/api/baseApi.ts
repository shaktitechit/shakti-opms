import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import {
  clearSessionFromStorage,
  getRefreshToken,
  readSessionFromStorage,
  saveSessionToStorage,
} from "@/utils/authStorage";
import { AUTH_SERVICE_URL, LEAD_MANAGER_SERVICE_URL } from "@/lib/env";
import type { UserSession } from "@/types/leadManager";

const rawBaseQuery = fetchBaseQuery({
  baseUrl: `${LEAD_MANAGER_SERVICE_URL}/api`,
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

export async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken() || readSessionFromStorage()?.refreshToken;
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${AUTH_SERVICE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      token?: string;
      refreshToken?: string;
      refreshExpiresIn?: number;
      user?: UserSession["user"];
      data?: {
        token?: string;
        refreshToken?: string;
        refreshExpiresIn?: number;
        user?: UserSession["user"];
      };
    };
    const token = data.token || data.data?.token;
    const newRefreshToken = data.refreshToken || data.data?.refreshToken || refreshToken;
    const refreshExpiresIn = data.refreshExpiresIn || data.data?.refreshExpiresIn;
    const existingSession = readSessionFromStorage();
    const user = data.user || data.data?.user || existingSession?.user;
    if (!token || !user) return false;
    saveSessionToStorage({
      token,
      refreshToken: newRefreshToken,
      refreshExpiresAt: refreshExpiresIn ? Date.now() + refreshExpiresIn * 1000 : Date.now() + 30 * 24 * 60 * 60 * 1000,
      user,
    });
    return true;
  } catch {
    return false;
  }
}

function forceLogout(): void {
  clearSessionFromStorage();
  if (typeof window !== "undefined" && window.location.pathname !== "/") {
    window.location.assign("/");
  }
}

const baseQueryWithAuth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  let result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status === 401 && !skipRefresh(requestUrl(args))) {
    if (!refreshInFlight) {
      refreshInFlight = refreshAccessToken().finally(() => {
        refreshInFlight = null;
      });
    }
    const ok = await refreshInFlight;
    if (ok) {
      // Retry original request with renewed access token
      result = await rawBaseQuery(args, api, extraOptions);
    } else {
      forceLogout();
    }
  }
  return result;
};

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithAuth,
  tagTypes: [
    "AuthSession",
    "Activity",
    "Attachments",
    "Parties",
    "Party",
    "Messages",
    "Orders",
    "Product",
    "Products",
    "ProductGroups",
    "ProductSubgroups",
    "ProductBrands",
    "ProductManufacturers",
    "Users",
    "CompanyInfo",
    "Lead",
    "LeadMaster",
    "LeadFollowUp",
    "LeadQuotation",
    "Quotation",
    "TermsAndConditions",
    "Notifications",
  ],
  endpoints: () => ({}),
});

export const medicaApi = baseApi;
