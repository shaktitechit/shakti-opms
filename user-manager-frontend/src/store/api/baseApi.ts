import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_BASE } from "@/utils/apiHelpers";
import { readSessionFromStorage } from "@/utils/authStorage";

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE.endsWith("/api") ? API_BASE : `${API_BASE}/api`,
    prepareHeaders(headers) {
      const session = readSessionFromStorage();
      if (session?.token) {
        headers.set("Authorization", `Bearer ${session.token}`);
      }
      return headers;
    },
  }),
  tagTypes: ["AuthSession", "CompanyInfo", "User", "Portal", "Department", "Role", "Notifications"],
  endpoints: () => ({}),
});
