import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { readSessionFromStorage } from "@/utils/authStorage";
import { WORK_PLANNER_SERVICE_URL } from "@/lib/env";

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: `${WORK_PLANNER_SERVICE_URL}/api`,
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
    "CompanyInfo",
    "WorkPlan",
    "WorkPlannerStats",
    "WorkPlannerTeam",
    "Expense",
    "Product",
    "Party",
    "Lead",
    "Notifications",
  ],
  endpoints: () => ({}),
});
