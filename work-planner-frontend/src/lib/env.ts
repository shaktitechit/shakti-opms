export const AUTH_SERVICE_URL =
  process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || "http://localhost:7003";

export const WORK_PLANNER_SERVICE_URL =
  process.env.NEXT_PUBLIC_WORK_PLANNER_SERVICE_URL || "http://localhost:7007";

export const PRODUCT_SERVICE_URL =
  process.env.NEXT_PUBLIC_PRODUCT_SERVICE_URL || "http://localhost:7005";

export const PARTY_SERVICE_URL =
  process.env.NEXT_PUBLIC_PARTY_SERVICE_URL || "http://localhost:7006";

export const LEAD_MANAGER_SERVICE_URL =
  process.env.NEXT_PUBLIC_LEAD_MANAGER_SERVICE_URL || "http://localhost:7009";

export const NOTIFICATION_SERVICE_URL =
  process.env.NEXT_PUBLIC_NOTIFICATION_SERVICE_URL || "http://localhost:7012";

export function publicNotificationServiceOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_NOTIFICATION_SERVICE_URL?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  return WORK_PLANNER_SERVICE_URL;
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

/**
 * Append JWT only for `/api/files/...` proxy URLs.
 * Presigned MinIO/file-manager URLs already carry signed query params — do not mutate them.
 */
export function withFileAccessToken(url: string, token?: string | null): string {
  if (!url || url === "#" || !token) return url || "";
  if (!/\/api\/files\//i.test(url)) return url;
  if (url.includes("token=")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
}

