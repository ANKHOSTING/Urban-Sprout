import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { isPro } from './purchases';
import { useAuth } from './auth';

const ProContext = createContext<{ pro: boolean; refresh: () => Promise<void> }>({ pro: false, refresh: async () => {} });

export function ProProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [pro, setPro] = useState(false);
  const refresh = useCallback(async () => setPro(await isPro()), []);
  useEffect(() => { refresh(); }, [refresh, session?.user.id]);
  return <ProContext.Provider value={{ pro, refresh }}>{children}</ProContext.Provider>;
}
export const usePro = () => useContext(ProContext);
