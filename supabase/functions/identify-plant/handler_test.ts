// Run: deno test supabase/functions/identify-plant/handler_test.ts  (no dependencies, no network)
import { createHandler, MAX_BODY_BYTES, parsePlant } from "./handler.ts";

function eq(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

const JPEG = "/9j/" + "A".repeat(200);
const aiReply = '```json\n{"name":"Basil","species":"Ocimum basilicum","sunlight":"Full sun","water_every_days":"2","location":"Window","tips":"Pinch buds.","confidence":"HIGH"}\n```';

function setup(opts: { user?: boolean; consume?: number | null; rpcError?: boolean; aiOk?: boolean } = {}) {
  const calls: string[] = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: opts.user === false ? null : { id: "u1" } } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
    rpc: async (name: string) => {
      calls.push(name);
      if (name === "try_consume_ai_usage") return opts.rpcError ? { data: null, error: { message: "boom" } } : { data: opts.consume === undefined ? 1 : opts.consume, error: null };
      return { data: null, error: null };
    },
  };
  const env: Record<string, string> = { SUPABASE_URL: "http://x", SUPABASE_ANON_KEY: "a", SUPABASE_SERVICE_ROLE_KEY: "s", AI_API_KEY: "k" };
  const fakeFetch = (async () => opts.aiOk === false
    ? new Response("no", { status: 500 })
    : new Response(JSON.stringify({ choices: [{ message: { content: aiReply } }] }))) as typeof fetch;
  const handler = createHandler({ createClient: () => client, env: (k) => env[k], fetch: fakeFetch });
  return { handler, calls };
}
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://x/identify-plant", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

Deno.test("parsePlant: fenced JSON, coercion and clamping", () => {
  eq(parsePlant(aiReply), { name: "Basil", species: "Ocimum basilicum", sunlight: "Full sun", water_every_days: 2, location: "Window", tips: "Pinch buds.", confidence: "high" });
  eq(parsePlant('{"name":"X","water_every_days":500}')?.water_every_days, 90);
  eq(parsePlant('{"name":"X","water_every_days":"lots"}')?.water_every_days, 7);
  eq(parsePlant('{"name":"X","confidence":"sure"}')?.confidence, "low");
  eq(parsePlant("no json here"), null);
  eq(parsePlant("{not json}"), null);
});

Deno.test("401 when not signed in", async () => {
  const { handler } = setup({ user: false });
  eq((await handler(post({ image: JPEG }))).status, 401);
});

Deno.test("413 on large content-length before reading body", async () => {
  const { handler } = setup();
  eq((await handler(post({ image: JPEG }, { "content-length": String(MAX_BODY_BYTES + 1) }))).status, 413);
});

Deno.test("400 on missing, invalid JSON, or non-JPEG image", async () => {
  const { handler } = setup();
  eq((await handler(post({}))).status, 400);
  eq((await handler(new Request("http://x", { method: "POST", body: "{bad" }))).status, 400);
  eq((await handler(post({ image: "iVBORw0KGgo" + "A".repeat(200) }))).status, 400); // PNG
});

Deno.test("429 when daily limit reached (RPC returns null)", async () => {
  const { handler, calls } = setup({ consume: null });
  const r = await handler(post({ image: JPEG }));
  eq(r.status, 429);
  eq((await r.json()).error, "limit_reached");
  eq(calls, ["try_consume_ai_usage"]);
});

Deno.test("500 generic error when RPC errors", async () => {
  const { handler } = setup({ rpcError: true });
  const r = await handler(post({ image: JPEG }));
  eq(r.status, 500);
  eq(await r.json(), { error: "Server error" });
});

Deno.test("refund when AI provider fails", async () => {
  const { handler, calls } = setup({ aiOk: false });
  eq((await handler(post({ image: JPEG }))).status, 502);
  eq(calls, ["try_consume_ai_usage", "refund_ai_usage"]);
});

Deno.test("200 success consumes without refund", async () => {
  const { handler, calls } = setup();
  const r = await handler(post({ image: JPEG }));
  eq(r.status, 200);
  eq((await r.json()).plant.species, "Ocimum basilicum");
  eq(calls, ["try_consume_ai_usage"]);
});
