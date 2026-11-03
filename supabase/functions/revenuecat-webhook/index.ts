// RevenueCat webhook -> mirrors the "pro" entitlement into public.subscriptions,
// so the plant-advice function can trust it server-side.
// Set secret REVENUECAT_WEBHOOK_AUTH and use the same value as the webhook's Authorization header in RevenueCat.
// The app calls Purchases.logIn(supabaseUserId), so app_user_id == Supabase user id.
import { createClient } from "npm:@supabase/supabase-js@2";
import { chooseExpiry, parseEventTimestamp, parseLifetimeProductIds } from "./logic.ts";

// Constant-time string comparison (avoids leaking the secret via timing).
function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

Deno.serve(async (req) => {
  // Fail closed: if the secret is not configured, refuse every request (never accept an "undefined" bearer).
  const secret = Deno.env.get("REVENUECAT_WEBHOOK_AUTH");
  if (!secret) {
    console.error("REVENUECAT_WEBHOOK_AUTH is not set; rejecting webhook");
    return new Response("server misconfigured", { status: 500 });
  }
  if (!safeEqual(req.headers.get("Authorization") ?? "", `Bearer ${secret}`)) {
    return new Response("unauthorized", { status: 401 });
  }
  let event: any;
  try {
    ({ event } = await req.json());
  } catch {
    return new Response("bad request", { status: 400 });
  }
  // Ignore RevenueCat SANDBOX (test purchase) events unless explicitly allowed, so test accounts can't grant Pro in prod.
  if (event?.environment === "SANDBOX" && Deno.env.get("ALLOW_SANDBOX_EVENTS") !== "true") {
    return new Response("ignored sandbox");
  }
  const userId: string | undefined = event?.app_user_id;
  if (!userId || userId.startsWith("$RCAnonymousID")) return new Response("ignored");
  const active = ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE", "NON_RENEWING_PURCHASE"].includes(event.type);
  const expired = ["EXPIRATION"].includes(event.type);
  if (!active && !expired) return new Response("ok");
  // Never grant unbounded Pro: active events always get an expiry (see logic.ts).
  // LIFETIME_PRODUCT_IDS (comma-separated) lists non-renewing products that grant Pro until 2099-12-31;
  // every other non-renewing product gets NON_RENEWING_DAYS (default 31).
  let expiresAt: string | null = null;
  if (active) {
    const r = chooseExpiry(event, {
      lifetimeIds: parseLifetimeProductIds(Deno.env.get("LIFETIME_PRODUCT_IDS")),
      nonRenewingDays: Number(Deno.env.get("NON_RENEWING_DAYS") ?? "31"),
      nowMs: Date.now(),
    });
    if (!r.ok) {
      console.error(r.reason, event.type);
      return new Response("missing expiration", { status: 400 });
    }
    expiresAt = r.expiresAt;
  }

  // Out-of-order guard: RevenueCat may deliver events late or out of order. The timestamp is mandatory and validated;
  // the SQL function applies the event atomically only if it is not older than the stored row (no read-then-write race).
  const when = parseEventTimestamp(event, Date.now());
  if (!when.ok) {
    console.error("rejecting event:", when.reason, event.type);
    return new Response(when.reason, { status: 400 });
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: applied, error } = await admin.rpc("apply_subscription_event", {
    p_user_id: userId,
    p_is_pro: active,
    p_expires_at: expiresAt,
    p_updated_at: new Date(when.ms).toISOString(),
  });
  if (error) {
    console.error("apply_subscription_event failed", error.message);
    return new Response("error", { status: 500 }); // non-2xx so RevenueCat retries
  }
  if (applied == null) {
    console.warn("ignoring stale event", event.type, event.event_timestamp_ms);
    return new Response("ignored stale event"); // 200: nothing to retry
  }
  return new Response("ok");
});
