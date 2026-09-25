import { baseApi } from "./baseApi";
import { AUTH_SERVICE_URL } from "@/lib/env";
import type { AuthUser, UserSession } from "@/types/leadManager";

type LoginApiResponse = {
  success?: boolean;
  token?: string;
  refreshToken?: string;
  refreshExpiresIn?: number;
  user?: AuthUser;
  data?: { token?: string; refreshToken?: string; refreshExpiresIn?: number; user?: AuthUser };
};

function normalizeSession(raw: LoginApiResponse): UserSession {
  const token = raw.token || raw.data?.token || "";
  const refreshToken = raw.refreshToken || raw.data?.refreshToken;
  const refreshExpiresIn = raw.refreshExpiresIn || raw.data?.refreshExpiresIn;
  const user = raw.user || raw.data?.user;
  if (!token || !user) {
    throw new Error("Invalid login response");
  }
  return {
    token,
    refreshToken,
    refreshExpiresIn,
    refreshExpiresAt: refreshExpiresIn ? Date.now() + refreshExpiresIn * 1000 : undefined,
    user,
  };
}

export const authApiSlice = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    login: builder.mutation<UserSession, { email?: string; password?: string }>({
      query: (credentials) => ({
        url: `${AUTH_SERVICE_URL}/api/auth/login`,
        method: "POST",
        body: credentials,
      }),
      transformResponse: (raw: LoginApiResponse) => normalizeSession(raw),
      invalidatesTags: ["AuthSession"],
    }),
    getMe: builder.query<{ user: AuthUser }, void>({
      query: () => `${AUTH_SERVICE_URL}/api/auth/me`,
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
        url: `${AUTH_SERVICE_URL}/api/auth/change-password`,
        method: "POST",
        body,
      }),
    }),
  }),
});

export const { useLoginMutation, useGetMeQuery, useChangePasswordMutation } =
  authApiSlice;
