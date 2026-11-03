import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const supabaseConfigured = !!url && !!anonKey && !url.includes('YOUR-PROJECT');

export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder', {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

export type Plant = {
  id: string; user_id: string; name: string; species: string | null; location: string | null;
  sunlight: string | null; water_every_days: number; notes: string | null;
  last_watered_at: string | null; created_at: string;
};
export type JournalEntry = { id: string; user_id: string; plant_id: string | null; body: string; photo_path: string | null; created_at: string };
export type Listing = {
  id: string; user_id: string; title: string; description: string | null; price_cents: number | null;
  is_trade: boolean; photo_path: string | null; location: string | null; created_at: string;
};

const SIGNED_URL_TTL_S = 60 * 60; // 1 hour
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

// Drop cached signed URLs whenever the signed-in user changes (sign-out, account switch) so they never leak across sessions.
let cacheUserId: string | null = null;
supabase.auth.onAuthStateChange((event, session) => {
  const uid = session?.user?.id ?? null;
  if (event === 'SIGNED_OUT' || uid !== cacheUserId) signedUrlCache.clear();
  cacheUserId = uid;
});

/** Short-lived signed URL for a private `photos` object. Null-safe: returns null on missing path or any error. */
export async function signedPhotoUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const hit = signedUrlCache.get(path);
  if (hit && hit.expiresAt > Date.now() + 60_000) return hit.url;
  try {
    const { data, error } = await supabase.storage.from('photos').createSignedUrl(path, SIGNED_URL_TTL_S);
    if (error || !data?.signedUrl) return null;
    signedUrlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + SIGNED_URL_TTL_S * 1000 });
    return data.signedUrl;
  } catch {
    return null;
  }
}

/** Upload a local image URI to the photos bucket under the user's folder. Returns storage path. */
export async function uploadPhoto(userId: string, uri: string): Promise<string> {
  const ext = (uri.split('.').pop() || 'jpg').toLowerCase().split('?')[0];
  const path = `${userId}/${Date.now()}.${ext}`;
  const res = await fetch(uri);
  const buf = await res.arrayBuffer();
  const { error } = await supabase.storage.from('photos').upload(path, buf, {
    contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
  });
  if (error) throw error;
  return path;
}

export const formatPrice = (l: Listing) =>
  l.is_trade ? 'Trade / swap' : l.price_cents == null ? 'Free' : `$${(l.price_cents / 100).toFixed(2)}`;
