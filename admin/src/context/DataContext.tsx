import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_CROWD } from '../types';
import type { AppUser, CrowdSettings, Queue, Service, Token } from '../types';
import { repo } from '../services/repo';
import { computeStats, type Stats } from '../utils/stats';
import { friendlyError, startOfToday } from '../utils/format';

interface Ctx {
  user: AppUser | null; authLoading: boolean;
  services: Service[]; queues: Queue[]; tokens: Token[]; students: AppUser[]; crowd: CrowdSettings;
  stats: Stats; error: string | null; toast: string | null;
  run: (fn: () => Promise<void>, okMsg?: string) => Promise<void>;
  setToast: (m: string | null) => void;
}
const C = createContext<Ctx>(null as never);
export const useData = () => useContext(C);

export function DataProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [students, setStudents] = useState<AppUser[]>([]);
  const [crowd, setCrowd] = useState<CrowdSettings>(DEFAULT_CROWD);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => repo.onAuth((u, l) => { setUser(u); setAuthLoading(l); }), []);

  useEffect(() => {
    if (!user) return;
    const onErr = (e: unknown) => setError(friendlyError(e));
    const unsubs = [
      repo.subscribeServices((s) => { setServices(s); setError(null); }, onErr),
      repo.subscribeQueues(setQueues, onErr),
      repo.subscribeTodayTokens(startOfToday(), setTokens, onErr),
      repo.subscribeStudents(setStudents, onErr),
      repo.subscribeSettings(setCrowd),
    ];
    return () => unsubs.forEach((u) => u());
  }, [user?.uid]);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3200); return () => clearTimeout(t); }, [toast]);

  const run = useCallback(async (fn: () => Promise<void>, okMsg?: string) => {
    try { await fn(); if (okMsg) setToast(okMsg); } catch (e) { setToast('⚠️ ' + friendlyError(e)); }
  }, []);

  const stats = useMemo(() => computeStats(tokens, queues, services), [tokens, queues, services]);
  return <C.Provider value={{ user, authLoading, services, queues, tokens, students, crowd, stats, error, toast, run, setToast }}>{children}</C.Provider>;
}
