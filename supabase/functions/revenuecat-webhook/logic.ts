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
  event: { type?: string; product_id?: unknown; expiration_at_ms?: unknown },
  opts: { lifetimeIds: Set<string>; nonRenewingDays: number; nowMs: number },
): ExpiryResult {
  if (event.type === "NON_RENEWING_PURCHASE" && typeof event.product_id === "string" && opts.lifetimeIds.has(event.product_id.trim())) {
    return { ok: true, expiresAt: LIFETIME_EXPIRY };
  }
  const ms = event.expiration_at_ms;
  if (ms !== undefined && ms !== null) { // present: must be a sane epoch-ms value (8.64e15 = max valid JS Date)
    if (typeof ms !== "number" || !Number.isSafeInteger(ms) || ms < 1e11 || ms > 8.64e15) {
      return { ok: false, reason: "expiration_at_ms invalid" };
    }
    return { ok: true, expiresAt: new Date(ms).toISOString() };
  }
  if (event.type === "NON_RENEWING_PURCHASE") {
    const days = Number.isFinite(opts.nonRenewingDays) && opts.nonRenewingDays > 0 ? opts.nonRenewingDays : 31;
    return { ok: true, expiresAt: new Date(opts.nowMs + days * DAY_MS).toISOString() };
  }
  return { ok: false, reason: "active event without expiration" };
}

export type EventTimeResult = { ok: true; ms: number } | { ok: false; reason: string };

const MIN_EVENT_MS = 1e11; // ~1973; anything smaller is almost certainly seconds, not milliseconds
const MAX_FUTURE_SKEW_MS = 5 * 60_000;

/**
 * Validates event_timestamp_ms: a safe integer within [1e11, now + 5 min]. Missing, non-numeric, too small
 * (e.g. seconds) or future-dated values are rejected so they can never poison the stored updated_at.
 */
export function parseEventTimestamp(event: { event_timestamp_ms?: unknown }, nowMs: number): EventTimeResult {
  const ms = event.event_timestamp_ms;
  if (ms === undefined || ms === null) return { ok: false, reason: "event_timestamp_ms missing" };
  if (typeof ms !== "number" || !Number.isSafeInteger(ms)) return { ok: false, reason: "event_timestamp_ms is not a safe integer" };
  if (ms < MIN_EVENT_MS) return { ok: false, reason: "event_timestamp_ms too small (not milliseconds?)" };
  if (ms > nowMs + MAX_FUTURE_SKEW_MS) return { ok: false, reason: "event_timestamp_ms is in the future" };
  return { ok: true, ms };
}
