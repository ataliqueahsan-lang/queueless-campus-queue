import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_CROWD } from '@/types';
import type { AppNotification, AppUser, CrowdSettings, Queue, Service, Token } from '@/types';
import { repo } from '@/services/repo';
import { messageFor, notifier } from '@/services/notifier';
import { friendlyError } from '@/utils/errors';
import { isActive, positionOf } from '@/utils/queueLogic';
import { buildViews, type ServiceView } from '@/utils/views';

interface DataCtx {
  loading: boolean; error: string | null; offline: boolean;
  services: Service[]; queues: Queue[]; views: ServiceView[]; crowd: CrowdSettings;
  tokens: Token[]; activeTokens: Token[]; notifications: AppNotification[]; unread: number;
}
const Ctx = createContext<DataCtx>(null as never);
export const useData = () => useContext(Ctx);

export function DataProvider({ user, children }: { user: AppUser | null; children: ReactNode }) {
  const [services, setServices] = useState<Service[]>([]);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [crowd, setCrowd] = useState<CrowdSettings>(DEFAULT_CROWD);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [ready, setReady] = useState({ s: false, q: false });

  useEffect(() => {
    if (!user) { setServices([]); setQueues([]); setTokens([]); setNotifications([]); setReady({ s: false, q: false }); return; }
    const onErr = (e: unknown) => setError(friendlyError(e, 'We can’t load live queue data right now.'));
    const unsubs = [
      repo.subscribeServices((s) => { setServices(s); setReady((r) => ({ ...r, s: true })); setError(null); }, onErr),
      repo.subscribeQueues((q, stale) => { setQueues(q); setOffline(stale); setReady((r) => ({ ...r, q: true })); }, onErr),
      repo.subscribeSettings(setCrowd),
      repo.subscribeMyTokens(user.uid, setTokens, onErr),
      repo.subscribeNotifications(user.uid, setNotifications),
    ];
    return () => unsubs.forEach((u) => u());
  }, [user?.uid]);

  // ---- Smart notifications: watches the student's own tokens and the live queue ----
  const seen = useRef<Record<string, { status: string; kind: string | null }>>({});
  useEffect(() => { if (!user) seen.current = {}; }, [user]);
  useEffect(() => {
    if (!user || !ready.q) return;
    tokens.forEach((t) => {
      const prev = seen.current[t.id];
      let kind: string | null = null;
      if (t.status === 'WAITING') {
        const q = queues.find((x) => x.serviceId === t.serviceId);
        if (!q) return;
        const pos = positionOf(q, t.tokenNumber);
        kind = pos === 1 ? 'next' : pos <= 3 ? 'soon' : 'joined';
      } else if (t.status === 'CALLED') kind = 'called';
      else if (prev && prev.status !== t.status && (t.status === 'COMPLETED' || t.status === 'SKIPPED')) kind = t.status.toLowerCase();
      seen.current[t.id] = { status: t.status, kind: kind ?? prev?.kind ?? null };
      if (kind && kind !== prev?.kind) {
        const m = messageFor(kind, t.tokenNumber);
        if (m) notifier.send(user.uid, `${t.id}_${kind}`, { ...m, type: kind });
      }
    });
  }, [tokens, queues, user, ready.q]);

  const value = useMemo<DataCtx>(() => ({
    loading: !!user && !(ready.s && ready.q), error, offline, services, queues, crowd,
    views: buildViews(services, queues, crowd),
    tokens, activeTokens: tokens.filter((t) => isActive(t.status)).sort((a, b) => b.createdAt - a.createdAt),
    notifications, unread: notifications.filter((n) => !n.read).length,
  }), [user, ready, error, offline, services, queues, crowd, tokens, notifications]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
