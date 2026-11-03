// Run in Node (from the repo root):
//   npx tsc --ignoreConfig --module commonjs --target es2020 --esModuleInterop --strict --types node --outDir /tmp/rcw supabase/functions/revenuecat-webhook/logic.ts supabase/functions/revenuecat-webhook/logic.test.ts && node /tmp/rcw/logic.test.js
import assert from "node:assert/strict";
import { chooseExpiry, eventTime, isStale, LIFETIME_EXPIRY, parseLifetimeProductIds } from "./logic";

const NOW = Date.parse("2026-11-03T12:00:00Z");
const opts = (ids: string) => ({ lifetimeIds: parseLifetimeProductIds(ids), nonRenewingDays: 31, nowMs: NOW });
const plus31 = new Date(NOW + 31 * 86_400_000).toISOString();

// parseLifetimeProductIds: trims, drops empties, handles unset
assert.deepEqual([...parseLifetimeProductIds(" a, b ,, c ,")], ["a", "b", "c"]);
assert.equal(parseLifetimeProductIds(undefined).size, 0);
assert.equal(parseLifetimeProductIds("").size, 0);

// chooseExpiry
assert.deepEqual(chooseExpiry({ type: "NON_RENEWING_PURCHASE", product_id: "lifetime" }, opts("x, lifetime")), { ok: true, expiresAt: LIFETIME_EXPIRY });
assert.equal(LIFETIME_EXPIRY.slice(0, 10), "2099-12-31");
assert.deepEqual(chooseExpiry({ type: "NON_RENEWING_PURCHASE", product_id: "other" }, opts("lifetime")), { ok: true, expiresAt: plus31 });
assert.deepEqual(chooseExpiry({ type: "NON_RENEWING_PURCHASE", product_id: "other" }, opts("")), { ok: true, expiresAt: plus31 });
assert.deepEqual(chooseExpiry({ type: "NON_RENEWING_PURCHASE" }, opts("lifetime")), { ok: true, expiresAt: plus31 }); // no product_id
// lifetime list only applies to NON_RENEWING_PURCHASE
assert.equal(chooseExpiry({ type: "RENEWAL", product_id: "lifetime", expiration_at_ms: NOW + 1000 }, opts("lifetime")).ok, true);
assert.deepEqual(chooseExpiry({ type: "RENEWAL", product_id: "lifetime", expiration_at_ms: NOW + 1000 }, opts("lifetime")), { ok: true, expiresAt: new Date(NOW + 1000).toISOString() });
assert.equal(chooseExpiry({ type: "RENEWAL", product_id: "lifetime" }, opts("lifetime")).ok, false); // no expiry -> rejected
assert.equal(chooseExpiry({ type: "INITIAL_PURCHASE", expiration_at_ms: "garbage" }, opts("")).ok, false);
// bad NON_RENEWING_DAYS falls back to 31
assert.deepEqual(chooseExpiry({ type: "NON_RENEWING_PURCHASE" }, { ...opts(""), nonRenewingDays: NaN }), { ok: true, expiresAt: plus31 });

// eventTime: explicit handling of missing/invalid timestamps
assert.deepEqual(eventTime({ event_timestamp_ms: 1700000000000 }, NOW), { ms: 1700000000000, fromEvent: true });
assert.deepEqual(eventTime({}, NOW), { ms: NOW, fromEvent: false });
assert.deepEqual(eventTime({ event_timestamp_ms: "abc" }, NOW), { ms: NOW, fromEvent: false });
assert.deepEqual(eventTime({ event_timestamp_ms: 0 }, NOW), { ms: NOW, fromEvent: false });

// isStale: older ignored, equal/newer processed, no row / bad row processed
const row = "2026-11-03T10:00:00.000Z", rowMs = Date.parse(row);
assert.equal(isStale(rowMs - 1, row), true);
assert.equal(isStale(rowMs, row), false);
assert.equal(isStale(rowMs + 1, row), false);
assert.equal(isStale(rowMs - 1, null), false);
assert.equal(isStale(rowMs - 1, undefined), false);
assert.equal(isStale(rowMs - 1, "not a date"), false);

console.log("revenuecat-webhook logic: all tests passed");
