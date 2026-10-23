// RevenueCat webhook -> mirrors the "pro" entitlement into public.subscriptions,
// so the plant-advice function can trust it server-side.
// Set secret REVENUECAT_WEBHOOK_AUTH and use the same value as the webhook's Authorization header in RevenueCat.
// The app calls Purchases.logIn(supabaseUserId), so app_user_id == Supabase user id.
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.headers.get("Authorization") !== `Bearer ${Deno.env.get("REVENUECAT_WEBHOOK_AUTH")}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const { event } = await req.json();
  const userId: string | undefined = event?.app_user_id;
  if (!userId || userId.startsWith("$RCAnonymousID")) return new Response("ignored");
  const active = ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE", "NON_RENEWING_PURCHASE"].includes(event.type);
  const expired = ["EXPIRATION"].includes(event.type);
  if (!active && !expired) return new Response("ok");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  await admin.from("subscriptions").upsert({
    user_id: userId,
    is_pro: active,
    expires_at: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null,
    updated_at: new Date().toISOString(),
  });
  return new Response("ok");
});
