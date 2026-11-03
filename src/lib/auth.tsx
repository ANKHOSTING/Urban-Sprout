import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { identifyPurchaser } from './purchases';

type Ctx = { session: Session | null; loading: boolean };
const AuthContext = createContext<Ctx>({ session: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    // Never leave the splash spinner up forever: if storage/network fails, fall through to signed-out.
    supabase.auth.getSession()
      .then(({ data }) => { if (alive) setSession(data.session); })
      .catch(() => { if (alive) setSession(null); })
      .finally(() => { if (alive) setLoading(false); });
    const timer = setTimeout(() => { if (alive) setLoading(false); }, 5000);
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => { alive = false; clearTimeout(timer); data.subscription.unsubscribe(); };
  }, []);
  useEffect(() => { identifyPurchaser(session?.user.id ?? null); }, [session?.user.id]);
  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
