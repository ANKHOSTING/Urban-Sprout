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

export type IdentifiedPlant = {
  name: string; species: string; sunlight: string; water_every_days: number;
  location: string; tips: string; confidence: 'high' | 'medium' | 'low';
};
export type IdentifyResult = { ok: true; plant: IdentifiedPlant } | { ok: false; message: string };

/** Calls the `identify-plant` Edge Function with a small base64 JPEG. Uses the same daily free limit as Ask AI. */
export async function identifyPlant(imageBase64: string): Promise<IdentifyResult> {
  const { data, error } = await supabase.functions.invoke('identify-plant', { body: { image: imageBase64 } });
  if (error) {
    let body: any = null;
    try { body = await (error as any).context?.json?.(); } catch { /* ignore */ }
    if (body?.error === 'limit_reached') return { ok: false, message: `You've used your ${body.limit} free AI uses today. Upgrade to Pro for unlimited.` };
    return { ok: false, message: body?.error ?? error.message };
  }
  if (!data?.plant) return { ok: false, message: 'No answer from the AI. Try again.' };
  return { ok: true, plant: data.plant };
}
