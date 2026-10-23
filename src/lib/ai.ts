import { supabase } from './supabase';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type AdviceResult =
  | { ok: true; reply: string; used: number; limit: number | null }
  | { ok: false; limitReached: boolean; message: string };

/** Calls the `plant-advice` Supabase Edge Function. The AI key lives only on the server. */
export async function askPlantAdvice(messages: ChatMessage[]): Promise<AdviceResult> {
  const { data, error } = await supabase.functions.invoke('plant-advice', { body: { messages } });
  if (error) {
    let body: any = null;
    try { body = await (error as any).context?.json?.(); } catch { /* ignore */ }
    if (body?.error === 'limit_reached') {
      return { ok: false, limitReached: true, message: `You've used your ${body.limit} free questions today.` };
    }
    return { ok: false, limitReached: false, message: body?.error ?? error.message };
  }
  return { ok: true, reply: data.reply, used: data.used, limit: data.limit };
}
