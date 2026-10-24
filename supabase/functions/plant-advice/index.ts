// Supabase Edge Function: AI plant advice with a free-tier daily limit.
// Secrets (set with `supabase secrets set`): AI_API_KEY, optional AI_BASE_URL, AI_MODEL, FREE_DAILY_LIMIT.
// Works with any OpenAI-compatible chat completions API (Fireworks by default; OpenAI, OpenRouter, etc. by changing AI_BASE_URL + AI_MODEL).
// SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are injected automatically.
import { createClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_BASE_URL = "https://api.fireworks.ai/inference/v1";
const DEFAULT_MODEL = "accounts/fireworks/models/nemotron-lightning-3p5-30b-a3b";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Not signed in" }, 401);

    const { messages } = await req.json() as { messages: { role: "user" | "assistant"; content: string }[] };
    if (!Array.isArray(messages) || messages.length === 0) return json({ error: "No messages" }, 400);

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
      body: JSON.stringify({
        model: Deno.env.get("AI_MODEL") || DEFAULT_MODEL,
        // Generous budget: some models spend tokens on hidden reasoning before answering.
        max_tokens: 1500,
        messages: [
          { role: "system", content: "You are Urban Sprout, a friendly expert on urban, balcony, and indoor gardening. Give concise, practical, safe plant-care advice. If unsure, say so." },
          ...messages.slice(-12).map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) })),
        ],
      }),
    });
    if (!resp.ok) return json({ error: "AI provider error" }, 502);
    const data = await resp.json();
    const reply: string = data.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't come up with an answer.";

    if (!isPro) used = (await admin.rpc("increment_ai_usage", { p_user: user.id })).data ?? used + 1;
    return json({ reply, isPro, used, limit: isPro ? null : limit });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
