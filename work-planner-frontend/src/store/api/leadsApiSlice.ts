import { baseApi } from "./baseApi";
import { LEAD_MANAGER_SERVICE_URL } from "@/lib/env";
import type { LeadListParams, LeadRecord } from "@/types/lead";

export const leadsApiSlice = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    getLeads: builder.query<LeadRecord[], LeadListParams | void>({
      query: (params) => {
        const query = new URLSearchParams();
        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") query.append(k, String(v));
          });
        }
        return `${LEAD_MANAGER_SERVICE_URL}/api/leads?${query.toString()}`;
      },
      transformResponse: (res: any) => {
        const rawData = res?.data ?? res;
        if (Array.isArray(rawData)) return rawData;
        if (rawData?.items && Array.isArray(rawData.items)) return rawData.items;
        if (rawData?.data && Array.isArray(rawData.data)) return rawData.data;
        return [];
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ _id, id }) => ({ type: "Lead" as const, id: _id || id })),
              { type: "Lead", id: "LIST" },
            ]
          : [{ type: "Lead", id: "LIST" }],
    }),
  }),
});

export const { useGetLeadsQuery } = leadsApiSlice;
