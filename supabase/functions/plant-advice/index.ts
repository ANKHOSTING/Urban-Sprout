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

    let body: { messages?: unknown };
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const raw = body?.messages;
    if (!Array.isArray(raw) || raw.length === 0) return json({ error: "No messages" }, 400);
    // Only user/assistant turns are accepted from clients; anything else (system, tool, ...) is rejected
    // so callers cannot override the server-side system prompt.
    const messages: { role: "user" | "assistant"; content: string }[] = [];
    for (const m of raw as { role?: unknown; content?: unknown }[]) {
      if ((m?.role !== "user" && m?.role !== "assistant") || typeof m.content !== "string") {
        return json({ error: "Invalid message role or content" }, 400);
      }
      messages.push({ role: m.role, content: m.content });
    }

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: sub } = await admin.from("subscriptions").select("is_pro, expires_at").eq("user_id", user.id).maybeSingle();
    const isPro = !!sub?.is_pro && (!sub.expires_at || new Date(sub.expires_at) > new Date());
    const limit = Number(Deno.env.get("FREE_DAILY_LIMIT") ?? "5");

    let used = 0;
    // Atomic reserve BEFORE the AI call (no read-then-write race); refunded if the AI call fails.
    const refund = async () => { if (!isPro) await admin.rpc("refund_ai_usage", { p_user: user.id }).then(() => {}, () => {}); };
    if (!isPro) {
      const { data: n, error: incErr } = await admin.rpc("increment_ai_usage", { p_user: user.id });
      if (incErr || typeof n !== "number") { console.error("usage increment failed", incErr?.message); return json({ error: "Something went wrong. Please try again." }, 500); }
      used = n;
      if (used > limit) { await refund(); return json({ error: "limit_reached", limit, used: limit }, 429); }
    }

    const apiKey = Deno.env.get("AI_API_KEY");
    if (!apiKey) { await refund(); return json({ error: "AI is not configured" }, 500); }
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
    if (!resp.ok) { console.error("AI provider", resp.status); await refund(); return json({ error: "AI provider error" }, 502); }
    const data = await resp.json();
    const reply: string = data.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't come up with an answer.";

    return json({ reply, isPro, used, limit: isPro ? null : limit });
  } catch (e) {
    console.error("plant-advice failed", e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
