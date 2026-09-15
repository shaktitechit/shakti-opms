import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { readSessionFromStorage } from "@/utils/authStorage";
import { NOTIFICATION_SERVICE_URL } from "@/lib/env";

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: `${NOTIFICATION_SERVICE_URL}/api`,
    prepareHeaders(headers) {
      const session = readSessionFromStorage();
      if (session?.token) {
        headers.set("Authorization", `Bearer ${session.token}`);
      }
      return headers;
    },
  }),
  tagTypes: ["AuthSession", "Notifications"],
  endpoints: () => ({}),
});

export const medicaApi = baseApi;
