export const AUTH_SERVICE_URL =
  process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || "http://localhost:7003";

export const NOTIFICATION_SERVICE_URL =
  process.env.NEXT_PUBLIC_NOTIFICATION_SERVICE_URL || "http://localhost:7012";

/** @deprecated Prefer NOTIFICATION_SERVICE_URL for shell APIs. */
export const LEAD_MANAGER_SERVICE_URL =
  process.env.NEXT_PUBLIC_LEAD_MANAGER_SERVICE_URL ||
  NOTIFICATION_SERVICE_URL;

export const OPMS_FRONTEND_URL = (
  process.env.NEXT_PUBLIC_OPMS_URL || "http://localhost:7002"
).replace(/\/+$/, "");

export const USER_MANAGER_FRONTEND_URL = (
  process.env.NEXT_PUBLIC_USER_MANAGER_URL || "http://localhost:7004/dashboard"
).replace(/\/+$/, "");

export const WORK_PLANNER_FRONTEND_URL = (
  process.env.NEXT_PUBLIC_WORK_PLANNER_URL || "http://localhost:7008/dashboard"
).replace(/\/+$/, "");

export const LEAD_MANAGER_FRONTEND_URL = (
  process.env.NEXT_PUBLIC_LEAD_MANAGER_URL || "http://localhost:7010/dashboard"
).replace(/\/+$/, "");

export function publicNotificationServiceOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_NOTIFICATION_SERVICE_URL?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  return NOTIFICATION_SERVICE_URL;
}

export function resolvePublicAssetUrl(path: string): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (/^data:image\//i.test(path)) return path;

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (cleanPath.startsWith("/uploads") || cleanPath.startsWith("/api/uploads")) {
    return `${AUTH_SERVICE_URL}${cleanPath}`;
  }

  if (typeof window !== "undefined") {
    return new URL(cleanPath, window.location.origin).href;
  }
  return `${AUTH_SERVICE_URL}${cleanPath}`;
}
