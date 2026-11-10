// Supabase Edge Function: identify a plant from a photo and return care info for the Add Plant form.
// Logic lives in handler.ts (unit-tested in handler_test.ts).
import { createClient } from "npm:@supabase/supabase-js@2";
import { createHandler } from "./handler.ts";

Deno.serve(createHandler({ createClient, env: (k) => Deno.env.get(k), fetch }));
