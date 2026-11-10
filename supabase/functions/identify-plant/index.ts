// Supabase Edge Function: identify a plant from a photo and return care info for the Add Plant form.
// Same auth + free-tier daily limit (ai_usage) as plant-advice. Secrets: AI_API_KEY, optional AI_BASE_URL,
// VISION_MODEL (must accept image input), FREE_DAILY_LIMIT.
import { createClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_BASE_URL = "https://api.fireworks.ai/inference/v1";
const DEFAULT_VISION_MODEL = "accounts/fireworks/models/deepseek-v4p1-flash"; // tested with image input, Nov 2026
const MAX_IMAGE_B64 = 1_500_000; // ~1.1 MB JPEG; the app sends ~100-300 KB

const PROMPT = `Identify the plant in this photo. Reply with ONLY a JSON object, no other text:
{"name": short common name, "species": scientific name, "sunlight": short sunlight need (e.g. "Bright indirect"),
"water_every_days": integer 1-90, "location": suggested spot (e.g. "Bright window"), "tips": 1-2 sentence care tips,
"confidence": "high" | "medium" | "low"}
If there is no plant in the photo, use "" for name and species and "low" for confidence.`;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Pull the first {...} object out of the model reply and coerce it to the fields the form uses. */
function parsePlant(text: string) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let o: Record<string, unknown>;
  try { o = JSON.parse(m[0]); } catch { return null; }
  const days = Math.round(Number(o.water_every_days));
  const conf = str(o.confidence, 10).toLowerCase();
  return {
    name: str(o.name, 80),
    species: str(o.species, 120),
    sunlight: str(o.sunlight, 80),
    water_every_days: Number.isFinite(days) ? Math.max(1, Math.min(90, days)) : 7,
    location: str(o.location, 80),
    tips: str(o.tips, 500),
    confidence: ["high", "medium", "low"].includes(conf) ? conf : "low",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Not signed in" }, 401);

    const { image } = await req.json().catch(() => ({})) as { image?: string };
    if (typeof image !== "string" || image.length < 100) return json({ error: "No image" }, 400);
    if (image.length > MAX_IMAGE_B64) return json({ error: "Image too large" }, 413);
    if (!/^[A-Za-z0-9+/=\r\n]+$/.test(image)) return json({ error: "Image must be base64 JPEG" }, 400);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: sub } = await admin.from("subscriptions").select("is_pro, expires_at").eq("user_id", user.id).maybeSingle();
    const isPro = !!sub?.is_pro && (!sub.expires_at || new Date(sub.expires_at) > new Date());
    const limit = Number(Deno.env.get("FREE_DAILY_LIMIT") ?? "5");

    let used = 0;
    if (!isPro) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: u } = await admin.from("ai_usage").select("count").eq("user_id", user.id).eq("day", today).maybeSingle();
      used = u?.count ?? 0;
      if (used >= limit) return json({ error: "limit_reached", limit, used }, 429);
    }

    const apiKey = Deno.env.get("AI_API_KEY");
    if (!apiKey) return json({ error: "AI is not configured" }, 500);
    const baseUrl = (Deno.env.get("AI_BASE_URL") || DEFAULT_BASE_URL).replace(/\/+$/, "");
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model: Deno.env.get("VISION_MODEL") || DEFAULT_VISION_MODEL,
        max_tokens: 1500, // room for hidden reasoning before the JSON
        temperature: 0.2,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image.replace(/\s/g, "")}` } },
          ],
        }],
      }),
    });
    if (!resp.ok) return json({ error: "AI provider error" }, 502);
    const data = await resp.json();
    const plant = parsePlant(String(data.choices?.[0]?.message?.content ?? ""));
    if (!plant) return json({ error: "Could not read the AI answer. Try another photo." }, 502);

    // Only count successful identifications against the free limit.
    if (!isPro) used = (await admin.rpc("increment_ai_usage", { p_user: user.id })).data ?? used + 1;
    return json({ plant, isPro, used, limit: isPro ? null : limit });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
