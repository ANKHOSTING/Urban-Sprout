// identify-plant request handler. Kept free of npm imports so it can be unit-tested with a fake Supabase client.
// Same auth + free daily limit (ai_usage, shared with plant-advice) as plant-advice.
// Secrets: AI_API_KEY, optional AI_BASE_URL, VISION_MODEL (must accept image input), FREE_DAILY_LIMIT, AI_TIMEOUT_MS.

const DEFAULT_BASE_URL = "https://api.fireworks.ai/inference/v1";
const DEFAULT_VISION_MODEL = "accounts/fireworks/models/deepseek-v4p1-flash"; // tested with image input, Nov 2026
export const MAX_BODY_BYTES = 2_000_000; // app sends ~100-300 KB
const MAX_IMAGE_B64 = 1_500_000;

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

/** Reads the body as JSON, counting bytes as they stream in. Returns "too_large" past maxBytes, null on bad JSON. */
export async function readJsonCapped(req: Request, maxBytes: number): Promise<unknown | "too_large" | null> {
  const reader = req.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { await reader.cancel().catch(() => {}); return "too_large"; }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(buf)); } catch { return null; }
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Pull the first {...} object out of the model reply and coerce it to the fields the form uses. */
export function parsePlant(text: string) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let o: Record<string, unknown>;
  try { o = JSON.parse(m[0]); } catch { return null; }
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
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

// Minimal shape of the Supabase client we use (lets tests pass a fake).
// deno-lint-ignore no-explicit-any
type Client = any;
export type Deps = {
  // deno-lint-ignore no-explicit-any
  createClient: (url: string, key: string, opts?: any) => Client;
  env: (k: string) => string | undefined;
  fetch: typeof fetch;
};

export function createHandler({ createClient, env, fetch }: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (Number(req.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) return json({ error: "Image too large" }, 413);
    let refund: () => Promise<void> = async () => {};
    try {
      const url = env("SUPABASE_URL")!;
      const userClient = createClient(url, env("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: "Not signed in" }, 401);

      const parsed = await readJsonCapped(req, MAX_BODY_BYTES);
      if (parsed === "too_large") return json({ error: "Image too large" }, 413);
      if (!parsed || typeof parsed !== "object") return json({ error: "Invalid JSON" }, 400);
      const body = parsed as { image?: unknown };
      const image = typeof body?.image === "string" ? body.image.replace(/\s/g, "") : "";
      if (image.length < 100) return json({ error: "No image" }, 400);
      if (image.length > MAX_IMAGE_B64) return json({ error: "Image too large" }, 413);
      if (!image.startsWith("/9j/") || !/^[A-Za-z0-9+/]+=*$/.test(image)) return json({ error: "Image must be a base64 JPEG" }, 400);

      const admin = createClient(url, env("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: sub } = await admin.from("subscriptions").select("is_pro, expires_at").eq("user_id", user.id).maybeSingle();
      const isPro = !!sub?.is_pro && !!sub.expires_at && new Date(sub.expires_at) > new Date(); // null expiry never grants Pro
      const limit = Number(env("FREE_DAILY_LIMIT") ?? "5");

      let used: number | null = null;
      if (!isPro) {
        // Atomic check-and-consume before the AI call; refunded below if anything fails.
        const { data: n, error } = await admin.rpc("try_consume_ai_usage", { p_user: user.id, p_limit: limit });
        if (error) { console.error("try_consume_ai_usage failed", error.message); return json({ error: "Server error" }, 500); }
        if (typeof n !== "number") return json({ error: "limit_reached", limit, used: limit }, 429);
        used = n;
        let done = false;
        refund = async () => {
          if (done) return;
          done = true;
          try {
            const { error } = await admin.rpc("refund_ai_usage", { p_user: user.id });
            if (error) console.error("refund_ai_usage failed", error.message);
          } catch (e) { console.error("refund_ai_usage threw", (e as Error)?.message); }
        };
      }

      const apiKey = env("AI_API_KEY");
      if (!apiKey) { await refund(); return json({ error: "AI is not configured" }, 500); }
      const baseUrl = (env("AI_BASE_URL") || DEFAULT_BASE_URL).replace(/\/+$/, "");
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(Number(env("AI_TIMEOUT_MS") ?? "45000")),
        body: JSON.stringify({
          model: env("VISION_MODEL") || DEFAULT_VISION_MODEL,
          max_tokens: 1500, // room for hidden reasoning before the JSON
          temperature: 0.2,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image}` } },
            ],
          }],
        }),
      });
      if (!resp.ok) { console.error("AI provider", resp.status); await refund(); return json({ error: "AI provider error" }, 502); }
      const data = await resp.json();
      const plant = parsePlant(String(data.choices?.[0]?.message?.content ?? ""));
      if (!plant) { await refund(); return json({ error: "Could not read the AI answer. Try another photo." }, 502); }

      refund = async () => {}; // success: keep the consumed unit
      return json({ plant, isPro, used, limit: isPro ? null : limit });
    } catch (e) {
      console.error("identify-plant failed", e);
      await refund();
      if ((e as Error)?.name === "TimeoutError") return json({ error: "The AI took too long. Please try again." }, 504);
      return json({ error: "Server error" }, 500);
    }
  };
}
