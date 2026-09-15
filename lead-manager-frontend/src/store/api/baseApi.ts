import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { readSessionFromStorage } from "@/utils/authStorage";
import { LEAD_MANAGER_SERVICE_URL } from "@/lib/env";

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: `${LEAD_MANAGER_SERVICE_URL}/api`,
    prepareHeaders(headers) {
      const session = readSessionFromStorage();
      if (session?.token) {
        headers.set("Authorization", `Bearer ${session.token}`);
      }
      return headers;
    },
  }),
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
