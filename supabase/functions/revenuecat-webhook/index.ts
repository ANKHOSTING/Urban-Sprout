// RevenueCat webhook -> mirrors the "pro" entitlement into public.subscriptions,
// so the plant-advice function can trust it server-side.
// Set secret REVENUECAT_WEBHOOK_AUTH and use the same value as the webhook's Authorization header in RevenueCat.
// The app calls Purchases.logIn(supabaseUserId), so app_user_id == Supabase user id.
import { createClient } from "npm:@supabase/supabase-js@2";

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
  // Never grant unbounded Pro: active events need an expiry. Subscriptions always carry one; NON_RENEWING_PURCHASE may
  // not, so it gets a bounded grant (NON_RENEWING_DAYS, default 31). Any other active event without expiry is rejected.
  let expiresAt: string | null = null;
  if (active) {
    const ms = Number(event.expiration_at_ms);
    if (Number.isFinite(ms) && ms > 0) {
      expiresAt = new Date(ms).toISOString();
    } else if (event.type === "NON_RENEWING_PURCHASE") {
      const days = Number(Deno.env.get("NON_RENEWING_DAYS") ?? "31");
      expiresAt = new Date(Date.now() + (Number.isFinite(days) && days > 0 ? days : 31) * 86_400_000).toISOString();
    } else {
      console.error("active event without expiration", event.type);
      return new Response("missing expiration", { status: 400 });
    }
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await admin.from("subscriptions").upsert({
    user_id: userId,
    is_pro: active,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error("subscriptions upsert failed", error.message);
    return new Response("error", { status: 500 }); // non-2xx so RevenueCat retries
  }
  return new Response("ok");
});
