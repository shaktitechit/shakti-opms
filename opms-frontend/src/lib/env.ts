/**
 * Public backend origin (`NEXT_PUBLIC_API_ORIGIN`).
 * Defaults to localhost for local dev against the Express API.
 */
export function publicApiOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_API_ORIGIN?.trim();
  if (!raw) return "http://localhost:7001";
  return raw.replace(/\/+$/, "");
}

/**
 * Public auth service origin (`NEXT_PUBLIC_AUTH_ORIGIN`).
 * Defaults to auth-service on http://localhost:7003 or falls back to main API origin.
 */
export function publicAuthOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_AUTH_ORIGIN?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  return "http://localhost:7003";
}

/**
 * Public product service origin (`NEXT_PUBLIC_PRODUCT_SERVICE_URL`).
 * Defaults to product-service on http://localhost:7005.
 */
export function publicProductServiceOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_PRODUCT_SERVICE_URL?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  return "http://localhost:7005";
}

/**
 * Public party service origin (`NEXT_PUBLIC_PARTY_SERVICE_URL`).
 * Defaults to party-service on http://localhost:7006.
 */
export function publicPartyServiceOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_PARTY_SERVICE_URL?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  return "http://localhost:7006";
}

/**
 * Public notification service origin (`NEXT_PUBLIC_NOTIFICATION_SERVICE_URL`).
 * Defaults to notification-service on http://localhost:7012 or falls back to main API origin.
 */
export function publicNotificationServiceOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_NOTIFICATION_SERVICE_URL?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  return publicApiOrigin();
}

/**
 * Web Push VAPID public key (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`).
 * Must match backend `VAPID_PUBLIC_KEY`. Falls back to API fetch when empty.
 */
export function publicVapidKey(): string {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || "";
}

/** Company name for PDF letterheads and branded exports (`NEXT_PUBLIC_COMPANY_NAME`). Prefer CompanyInfo API when available. */
export function companyLetterheadName(): string {
  return process.env.NEXT_PUBLIC_COMPANY_NAME?.trim() || "";
}

/** Logo path or URL for PDF letterheads (`NEXT_PUBLIC_COMPANY_LOGO_URL`). Prefer CompanyInfo API when available. */
export function companyLetterheadLogoUrl(): string {
  return process.env.NEXT_PUBLIC_COMPANY_LOGO_URL?.trim() || "";
}

/** Resolves a public logo path to an absolute URL for canvas/PDF capture. */
export function resolvePublicAssetUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (typeof window !== "undefined") {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return new URL(normalized, window.location.origin).href;
  }
  return path.startsWith("/") ? path : `/${path}`;
}
