import { medicaApi } from "../baseApi";
import { unwrapEnvelope, type ApiEnvelope } from "../unwrap";
import { AUTH_SERVICE_URL } from "@/lib/env";

/** User service API — RBAC catalogue + roster from Auth User Service. */
export const usersApi = medicaApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (build) => ({
    listRoles: build.query<unknown, void>({
      query: () => ({ url: `${AUTH_SERVICE_URL}/api/users/roles`, method: "GET" }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      providesTags: [{ type: "Users", id: "roles" }],
    }),
    listPermissions: build.query<unknown, void>({
      query: () => ({ url: `${AUTH_SERVICE_URL}/api/users/permissions`, method: "GET" }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      providesTags: [{ type: "Users", id: "permissions" }],
    }),
    listUsers: build.query<
      unknown,
      Record<string, string | undefined> | void
    >({
      query: (params) => ({
        url: `${AUTH_SERVICE_URL}/api/users`,
        params: params ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      providesTags: [{ type: "Users", id: "LIST" }],
    }),
    getUser: build.query<unknown, string>({
      query: (id) => `${AUTH_SERVICE_URL}/api/users/${id}`,
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      providesTags: (_r, _e, id) => [{ type: "Users", id }],
    }),
    createUser: build.mutation<unknown, Record<string, unknown>>({
      query: (body) => ({ url: `${AUTH_SERVICE_URL}/api/users`, method: "POST", body }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: ["Users"],
    }),
    patchUser: build.mutation<
      unknown,
      { id: string; patch: Record<string, unknown> }
    >({
      query: ({ id, patch }) => ({
        url: `${AUTH_SERVICE_URL}/api/users/${id}`,
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: (_r, _e, arg) => [
        "Users",
        { type: "Users", id: arg.id },
      ],
    }),
    deleteUser: build.mutation<unknown, string>({
      query: (id) => ({
        url: `${AUTH_SERVICE_URL}/api/users/${id}`,
        method: "DELETE",
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: ["Users"],
    }),
  }),
});

export const {
  useListRolesQuery,
  useListPermissionsQuery,
  useListUsersQuery,
  useLazyListUsersQuery,
  useGetUserQuery,
  useLazyGetUserQuery,
  useCreateUserMutation,
  usePatchUserMutation,
  useDeleteUserMutation,
} = usersApi;

export const useGetUsersQuery = useListUsersQuery;
