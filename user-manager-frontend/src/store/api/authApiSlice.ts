import { baseApi } from "./baseApi";
import type { AuthUser, UserSession } from "@/types/userManager";

export const authApiSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<UserSession, { email?: string; password?: string }>({
      query: (credentials) => ({
        url: "/auth/login",
        method: "POST",
        body: credentials,
      }),
      invalidatesTags: ["AuthSession"],
    }),
    getMe: builder.query<{ user: AuthUser }, void>({
      query: () => "/auth/me",
      transformResponse: (raw: { user?: AuthUser; data?: AuthUser }) => ({
        user: raw.user || raw.data!,
      }),
      providesTags: ["AuthSession"],
    }),
    changePassword: builder.mutation<
      { success: boolean; message?: string },
      { currentPassword: string; newPassword: string }
    >({
      query: (body) => ({
        url: "/auth/change-password",
        method: "POST",
        body,
      }),
    }),
  }),
});

export const { useLoginMutation, useGetMeQuery, useChangePasswordMutation } =
  authApiSlice;
