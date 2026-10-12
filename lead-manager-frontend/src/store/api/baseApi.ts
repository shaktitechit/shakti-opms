import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import {
  invalidateLocalSession,
  readSessionFromStorage,
  refreshAccessToken,
} from "@/utils/authStorage";
import { LEAD_MANAGER_SERVICE_URL } from "@/lib/env";

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

export { refreshAccessToken };

const baseQueryWithAuth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  let result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status === 401 && !skipRefresh(requestUrl(args))) {
    const ok = await refreshAccessToken();
    if (ok) {
      result = await rawBaseQuery(args, api, extraOptions);
    } else {
      invalidateLocalSession("/");
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
    "LeadTeam",
  ],
  endpoints: () => ({}),
});

export const medicaApi = baseApi;
