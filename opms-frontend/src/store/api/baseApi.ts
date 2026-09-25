import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";

import { publicApiOrigin } from "@/lib/env";
import { clearSessionMarks } from "@/lib/sessionCookie";
import { logout, setCredentials, type AuthUser } from "@/store/slices/authSlice";

type AuthSnap = {
  auth?: { token?: string | null; refreshToken?: string | null; user?: AuthUser | null };
};

const rawBaseQuery = fetchBaseQuery({
  baseUrl: `${publicApiOrigin()}/api`,
  prepareHeaders(headers, api) {
    const token = (api.getState() as AuthSnap).auth?.token;
    if (token) headers.set("Authorization", `Bearer ${token}`);
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

async function refreshAccessToken(api: {
  getState: () => unknown;
  dispatch: (action: unknown) => unknown;
}): Promise<boolean> {
  const session = (api.getState() as AuthSnap).auth;
  if (!session?.refreshToken) return false;
  try {
    const res = await fetch(`${publicApiOrigin()}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      token?: string;
      refreshToken?: string;
      user?: AuthUser;
      data?: { token?: string; refreshToken?: string; user?: AuthUser };
    };
    const token = data.token || data.data?.token;
    const refreshToken = data.refreshToken || data.data?.refreshToken;
    const user = data.user || data.data?.user || session.user;
    if (!token || !refreshToken || !user) return false;
    api.dispatch(setCredentials({ token, refreshToken, user }));
    return true;
  } catch {
    return false;
  }
}

function forceLogout(api: { dispatch: (action: unknown) => unknown }): void {
  api.dispatch(logout());
  clearSessionMarks();
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.assign("/login");
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
    refreshInFlight = refreshAccessToken(api).finally(() => {
      refreshInFlight = null;
    });
  }
  const ok = await refreshInFlight;
  if (!ok) {
    forceLogout(api);
    return result;
  }
  return rawBaseQuery(args, api, extraOptions);
};

/** Swagger / `app.js` domain tags → cache invalidation buckets. */
export const medicaApi = createApi({
  reducerPath: "medicaApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: [
    "AuthSession",
    "Activity",
    "Approvals",
    "Attachments",
    "Collections",
    "Parties",
    "PartyProducts",
    "Dashboard",
    "Dispatch",
    "Drivers",
    "FinanceQueue",
    "FinanceSummary",
    "Flags",
    "Invoices",
    "Notifications",
    "Messages",
    "Order",
    "Orders",
    "OrderApprovals",
    "UnbilledOrders",
    "Payments",
    "Reminders",
    "TransportPlans",

    "Products",
    "ProductGroups",
    "ProductSubgroups",
    "ProductBrands",
    "ProductManufacturers",
    "ProductKitItems",
    "Transport",
    "TransportAgents",
    "Users",
    "Vehicles",
    "Zones",
    "CompanyInfo",
    "Lead",
    "LeadMaster",
    "LeadFollowUp",
    "LeadQuotation",
    "Quotation",
    "TermsAndConditions",
  ],
  endpoints: () => ({}),
});

export type MedicaApi = typeof medicaApi;
