// Demo mode: same interface as FirebaseRepo, everything in memory. Lets the whole app be shown
// without any Firebase credentials. It reuses the SAME queue logic as the real transactions.
import { DEFAULT_CROWD } from '@/types';
import type { AppNotification, AppUser, CrowdSettings, Queue, Service, Token } from '@/types';
import { QueueError, applyCall, applyJoin, applyRemove, isActive, tokenDocId } from '@/utils/queueLogic';
import type { DemoControls, Repo, Unsub } from './repo';
import { SEED_QUEUES, SEED_SERVICES, buildSeedTokens } from './seedData';

const DEMO_UID = 'demo-student';

export class MockRepo implements Repo {
  mode = 'demo' as const;
  private user: AppUser | null = null;
  private authL = new Set<(u: AppUser | null, l: boolean) => void>();
  private services: Service[] = [...SEED_SERVICES];
  private queues: Queue[] = SEED_QUEUES.map((q) => ({ ...q }));
  private tokens: Token[] = [];
  private notes: AppNotification[] = [];
  private bus = new Set<() => void>();
  private fakeCount = 0;

  constructor() {
    this.tokens = buildSeedTokens(SEED_SERVICES, SEED_QUEUES).filter((t) => t.status === 'WAITING');
    const now = Date.now(); const d = new Date(); d.setHours(12, 20, 0, 0);
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(16, 10, 0, 0);
    const hist = (n: number, serviceId: string, serviceName: string, at: number): Token => ({
      id: `hist-${serviceId}-${n}`, tokenNumber: n, serviceId, serviceName, userId: DEMO_UID, userName: 'Demo Student', status: 'COMPLETED',
      positionAtJoin: 2, createdAt: at - 480000, calledAt: at - 120000, completedAt: at,
    });
    this.tokens.push(hist(8, 'canteen', 'Canteen', Math.min(d.getTime(), now - 600000)), hist(21, 'library', 'Library', yesterday.getTime()));
  }

  private emit() { this.bus.forEach((f) => f()); }
  private sub<T>(get: () => T, cb: (v: T) => void): Unsub {
    const f = () => cb(get()); this.bus.add(f); f();
    return () => { this.bus.delete(f); };
  }

  onAuth(cb: (u: AppUser | null, loading: boolean) => void): Unsub {
    this.authL.add(cb); cb(this.user, false);
    return () => { this.authL.delete(cb); };
  }
  private setUser(u: AppUser | null) { this.user = u; this.authL.forEach((f) => f(u, false)); }
  async signIn(email: string) {
    this.setUser({ uid: DEMO_UID, name: 'Demo Student', studentId: 'CS2024-042', email: email || 'student@queueless.demo', role: 'STUDENT' });
  }
  async register(i: { name: string; studentId: string; email: string }) {
    this.setUser({ uid: DEMO_UID, name: i.name, studentId: i.studentId, email: i.email, role: 'STUDENT' });
  }
  async signOut() { this.setUser(null); }
  async updateProfile(_uid: string, p: { name: string; studentId: string }) { if (this.user) this.setUser({ ...this.user, ...p }); }

  subscribeServices(cb: (s: Service[]) => void) { return this.sub(() => [...this.services], cb); }
  subscribeQueues(cb: (q: Queue[], stale: boolean) => void) { return this.sub(() => this.queues.map((q) => ({ ...q })), (q) => cb(q, false)); }
  subscribeSettings(cb: (c: CrowdSettings) => void) { return this.sub(() => DEFAULT_CROWD, cb); }
  subscribeMyTokens(uid: string, cb: (t: Token[]) => void) { return this.sub(() => this.tokens.filter((t) => t.userId === uid), cb); }
  subscribeNotifications(uid: string, cb: (n: AppNotification[]) => void) {
    return this.sub(() => this.notes.filter((n) => n.userId === uid).sort((a, b) => b.createdAt - a.createdAt), cb);
  }

  private qi(serviceId: string) {
    const i = this.queues.findIndex((q) => q.serviceId === serviceId);
    if (i < 0) throw new QueueError('NOT_FOUND');
    return i;
  }

  async joinQueue(user: AppUser, serviceId: string): Promise<Token> {
    const i = this.qi(serviceId);
    if (this.tokens.some((t) => t.userId === user.uid && t.serviceId === serviceId && isActive(t.status))) throw new QueueError('DUPLICATE');
    const { queue, tokenNumber } = applyJoin(this.queues[i]);
    const token: Token = {
      id: tokenDocId(serviceId, tokenNumber), tokenNumber, serviceId, serviceName: this.services.find((s) => s.id === serviceId)?.name ?? serviceId,
      userId: user.uid, userName: user.name, status: 'WAITING', positionAtJoin: queue.waitingNumbers.length,
      createdAt: Date.now(), calledAt: null, completedAt: null,
    };
    this.queues[i] = queue; this.tokens.push(token); this.emit();
    return token;
  }

  async leaveQueue(token: Token) {
    const t = this.tokens.find((x) => x.id === token.id);
    if (!t || t.status !== 'WAITING') throw new QueueError('BAD_TRANSITION');
    const i = this.qi(t.serviceId);
    this.queues[i] = applyRemove(this.queues[i], t.tokenNumber);
    this.tokens = this.tokens.map((x) => (x.id === t.id ? { ...x, status: 'CANCELLED' as const, completedAt: Date.now() } : x));
    this.emit();
  }

  async pushNotification(uid: string, id: string, n: { title: string; body: string; type: string }) {
    if (this.notes.some((x) => x.id === id)) return;
    this.notes.push({ id, userId: uid, ...n, read: false, createdAt: Date.now() }); this.emit();
  }
  async markRead(_uid: string, ids: string[]) { this.notes = this.notes.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)); this.emit(); }

  /** "Staff" buttons shown on the token screen in demo mode, so the flow can be shown on one device. */
  demo: DemoControls = {
    callNext: (serviceId) => {
      const i = this.qi(serviceId); const before = this.queues[i];
      try {
        const { queue, target } = applyCall(before);
        const now = Date.now();
        this.tokens = this.tokens.map((t) => {
          if (t.serviceId !== serviceId) return t;
          if (t.tokenNumber === target) return { ...t, status: 'CALLED' as const, calledAt: now };
          if (t.tokenNumber === before.currentToken && (t.status === 'CALLED' || t.status === 'SERVING')) return { ...t, status: 'COMPLETED' as const, completedAt: now };
          return t;
        });
        this.queues[i] = queue; this.emit();
      } catch { /* empty or paused: nothing to call */ }
    },
    completeCurrent: (serviceId) => {
      const cur = this.queues[this.qi(serviceId)].currentToken; const now = Date.now();
      this.tokens = this.tokens.map((t) => (t.serviceId === serviceId && t.tokenNumber === cur && (t.status === 'CALLED' || t.status === 'SERVING') ? { ...t, status: 'COMPLETED' as const, completedAt: now } : t));
      this.emit();
    },
    addPeople: (serviceId, n) => {
      for (let k = 0; k < n; k++) {
        const i = this.qi(serviceId);
        try {
          const { queue, tokenNumber } = applyJoin(this.queues[i]);
          this.queues[i] = queue;
          this.tokens.push({
            id: tokenDocId(serviceId, tokenNumber), tokenNumber, serviceId, serviceName: this.services.find((s) => s.id === serviceId)?.name ?? serviceId,
            userId: `demo-extra-${this.fakeCount++}`, userName: 'Student', status: 'WAITING', positionAtJoin: queue.waitingNumbers.length,
            createdAt: Date.now(), calledAt: null, completedAt: null,
          });
        } catch { break; }
      }
      this.emit();
    },
  };
}
