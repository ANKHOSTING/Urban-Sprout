// Run with Deno from the repo root: deno test supabase/functions/revenuecat-webhook/logic.test.ts
import assert from "node:assert/strict";
import { chooseExpiry, LIFETIME_EXPIRY, parseEventTimestamp, parseLifetimeProductIds } from "./logic.ts";

const NOW = Date.parse("2026-11-03T12:00:00Z");
const opts = (ids: string) => ({ lifetimeIds: parseLifetimeProductIds(ids), nonRenewingDays: 31, nowMs: NOW });
const plus31 = new Date(NOW + 31 * 86_400_000).toISOString();

Deno.test("revenuecat-webhook logic", () => {
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

  // parseEventTimestamp: required safe integer in [1e11, now + 5 min]
  const ok = (ms: unknown) => parseEventTimestamp({ event_timestamp_ms: ms }, NOW);
  assert.deepEqual(ok(1700000000000), { ok: true, ms: 1700000000000 });
  assert.deepEqual(ok(1e11), { ok: true, ms: 1e11 });
  assert.deepEqual(ok(NOW), { ok: true, ms: NOW });
  assert.deepEqual(ok(NOW + 5 * 60_000), { ok: true, ms: NOW + 5 * 60_000 });
  assert.equal(ok(NOW + 5 * 60_000 + 1).ok, false); // future
  assert.equal(ok(1e11 - 1).ok, false); // too small
  assert.equal(ok(1700000000).ok, false); // seconds, not ms
  assert.equal(ok(0).ok, false);
  assert.equal(ok(-5).ok, false);
  assert.equal(ok(1700000000000.5).ok, false); // not an integer
  assert.equal(ok(NaN).ok, false);
  assert.equal(ok(Infinity).ok, false);
  assert.equal(ok(2 ** 60).ok, false); // not a safe integer
  assert.equal(ok("1700000000000").ok, false); // string
  assert.equal(ok([1700000000000]).ok, false); // array that would coerce
  assert.equal(ok(null).ok, false);
  assert.equal(parseEventTimestamp({}, NOW).ok, false); // missing
  assert.match((parseEventTimestamp({}, NOW) as { reason: string }).reason, /missing/);

  // non-string product_id must not throw
  assert.deepEqual(chooseExpiry({ type: "NON_RENEWING_PURCHASE", product_id: 123 }, opts("123")), { ok: true, expiresAt: plus31 });
  assert.deepEqual(chooseExpiry({ type: "NON_RENEWING_PURCHASE", product_id: { trim: 1 } }, opts("lifetime")), { ok: true, expiresAt: plus31 });
  assert.deepEqual(chooseExpiry({ type: "NON_RENEWING_PURCHASE", product_id: null }, opts("lifetime")), { ok: true, expiresAt: plus31 });
});
