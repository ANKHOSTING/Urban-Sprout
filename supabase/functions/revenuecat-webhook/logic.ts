// Pure helpers for the RevenueCat webhook (no Deno/Supabase APIs, so they can be unit-tested in Node).

export const LIFETIME_EXPIRY = "2099-12-31T23:59:59.000Z";
const DAY_MS = 86_400_000;

/** Parses LIFETIME_PRODUCT_IDS ("a, b ,c"): comma-separated, trimmed, empty entries dropped. */
export function parseLifetimeProductIds(raw: string | undefined | null): Set<string> {
  return new Set((raw ?? "").split(",").map((s) => s.trim()).filter((s) => s.length > 0));
}

export type ExpiryResult = { ok: true; expiresAt: string } | { ok: false; reason: string };

/**
 * Expiry for an ACTIVE event. Never unbounded:
 * - NON_RENEWING_PURCHASE with a product in LIFETIME_PRODUCT_IDS -> LIFETIME_EXPIRY (2099-12-31).
 * - Otherwise a valid expiration_at_ms from RevenueCat is used as-is.
 * - NON_RENEWING_PURCHASE without expiry -> now + nonRenewingDays (31 by default).
 * - Any other active event without expiry -> rejected.
 */
export function chooseExpiry(
  event: { type?: string; product_id?: string; expiration_at_ms?: unknown },
  opts: { lifetimeIds: Set<string>; nonRenewingDays: number; nowMs: number },
): ExpiryResult {
  if (event.type === "NON_RENEWING_PURCHASE" && event.product_id && opts.lifetimeIds.has(event.product_id.trim())) {
    return { ok: true, expiresAt: LIFETIME_EXPIRY };
  }
  const ms = Number(event.expiration_at_ms);
  if (Number.isFinite(ms) && ms > 0) return { ok: true, expiresAt: new Date(ms).toISOString() };
  if (event.type === "NON_RENEWING_PURCHASE") {
    const days = Number.isFinite(opts.nonRenewingDays) && opts.nonRenewingDays > 0 ? opts.nonRenewingDays : 31;
    return { ok: true, expiresAt: new Date(opts.nowMs + days * DAY_MS).toISOString() };
  }
  return { ok: false, reason: "active event without expiration" };
}

export type EventTime = { ms: number; fromEvent: boolean };

/**
 * Time to store as updated_at. Uses event_timestamp_ms; if it is missing/invalid, falls back to the receive time
 * (fromEvent=false) so the event is still processed but the caller can log the anomaly.
 */
export function eventTime(event: { event_timestamp_ms?: unknown }, nowMs: number): EventTime {
  const ms = Number(event.event_timestamp_ms);
  return Number.isFinite(ms) && ms > 0 ? { ms, fromEvent: true } : { ms: nowMs, fromEvent: false };
}

/** True when the event is strictly older than the stored row (out-of-order delivery). Equal timestamps are processed. */
export function isStale(eventMs: number, existingUpdatedAt: string | null | undefined): boolean {
  if (!existingUpdatedAt) return false;
  const existing = Date.parse(existingUpdatedAt);
  return Number.isFinite(existing) && eventMs < existing;
}
