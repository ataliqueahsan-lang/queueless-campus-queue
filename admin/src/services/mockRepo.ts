// Demo mode: same interface as the Firebase repo, but everything lives in memory.
import { DEFAULT_CROWD } from '../types';
import type { AppUser, CrowdSettings, Queue, QueueStatus, Service, Token, TokenStatus } from '../types';
import { QueueError, applyCall, applyRemove, canTransition, tokenDocId } from '../utils/queueLogic';
import type { AdminRepo, ServiceInput, Unsub } from './repo';
import { SEED_QUEUES, SEED_SERVICES, buildSeedTokens } from './seedData';

export class MockAdminRepo implements AdminRepo {
  mode = 'demo' as const;
  private user: AppUser | null = null;
  private authL = new Set<(u: AppUser | null, l: boolean) => void>();
  private services: Service[] = [...SEED_SERVICES];
  private queues: Queue[] = SEED_QUEUES.map((q) => ({ ...q }));
  private tokens: Token[] = buildSeedTokens(SEED_SERVICES, SEED_QUEUES);
  private settings: CrowdSettings = DEFAULT_CROWD;
  private bus = new Set<() => void>();

  private emit() { this.bus.forEach((f) => f()); }
  private sub<T>(get: () => T, cb: (v: T) => void): Unsub {
    const f = () => cb(get()); this.bus.add(f); f();
    return () => { this.bus.delete(f); };
  }

  onAuth(cb: (u: AppUser | null, loading: boolean) => void): Unsub {
    this.authL.add(cb); cb(this.user, false);
    return () => { this.authL.delete(cb); };
  }
  async signIn(email: string) {
    this.user = { uid: 'demo-admin', name: 'Demo Admin', studentId: '', email: email || 'admin@queueless.demo', role: 'ADMIN' };
    this.authL.forEach((f) => f(this.user, false));
  }
  async signOut() { this.user = null; this.authL.forEach((f) => f(null, false)); }

  subscribeServices(cb: (s: Service[]) => void) { return this.sub(() => [...this.services].sort((a, b) => a.order - b.order), cb); }
  subscribeQueues(cb: (q: Queue[]) => void) { return this.sub(() => this.queues.map((q) => ({ ...q })), cb); }
  subscribeTodayTokens(_s: number, cb: (t: Token[]) => void) { return this.sub(() => [...this.tokens], cb); }
  subscribeStudents(cb: (u: AppUser[]) => void) {
    return this.sub(() => Array.from(new Set(this.tokens.map((t) => t.userId))).map((id, i) => ({
      uid: id, name: this.tokens.find((t) => t.userId === id)!.userName, studentId: `CS2024-${String(100 + i)}`,
      email: `${this.tokens.find((t) => t.userId === id)!.userName.toLowerCase()}@campus.demo`, role: 'STUDENT' as const,
    })), cb);
  }
  subscribeSettings(cb: (c: CrowdSettings) => void) { return this.sub(() => this.settings, cb); }

  private q(serviceId: string) {
    const i = this.queues.findIndex((q) => q.serviceId === serviceId);
    if (i < 0) throw new QueueError('NOT_FOUND');
    return i;
  }

  async callToken(serviceId: string, tokenNumber: number | null) {
    const i = this.q(serviceId);
    const before = this.queues[i];
    const { queue, target } = applyCall(before, tokenNumber ?? undefined);
    const now = Date.now();
    this.tokens = this.tokens.map((t) => {
      if (t.serviceId !== serviceId) return t;
      if (t.tokenNumber === target) return { ...t, status: 'CALLED' as const, calledAt: now };
      if (t.tokenNumber === before.currentToken && (t.status === 'CALLED' || t.status === 'SERVING')) return { ...t, status: 'COMPLETED' as const, completedAt: now };
      return t;
    });
    this.queues[i] = queue; this.emit();
  }

  async setTokenStatus(token: Token, status: TokenStatus) {
    const cur = this.tokens.find((t) => t.id === token.id);
    if (!cur) throw new QueueError('NOT_FOUND');
    if (!canTransition(cur.status, status)) throw new QueueError('BAD_TRANSITION');
    const now = Date.now();
    if (cur.status === 'WAITING' && (status === 'SKIPPED' || status === 'CANCELLED')) {
      const i = this.q(cur.serviceId); this.queues[i] = applyRemove(this.queues[i], cur.tokenNumber);
    }
    this.tokens = this.tokens.map((t) => t.id !== cur.id ? t : {
      ...t, status, calledAt: status === 'CALLED' ? now : t.calledAt,
      completedAt: ['COMPLETED', 'SKIPPED', 'CANCELLED'].includes(status) ? now : t.completedAt,
    });
    this.emit();
  }

  async setQueueStatus(serviceId: string, status: QueueStatus) {
    const i = this.q(serviceId); this.queues[i] = { ...this.queues[i], status }; this.emit();
  }

  async saveService(s: ServiceInput) {
    const exists = this.services.some((x) => x.id === s.id);
    if (exists) this.services = this.services.map((x) => (x.id === s.id ? { ...x, ...s, order: s.order ?? x.order } : x));
    else {
      this.services.push({ ...s, order: s.order ?? this.services.length + 1 });
      this.queues.push({ serviceId: s.id, currentToken: 0, nextToken: 1, status: 'OPEN', estimatedServiceTime: s.estimatedServiceTime, waitingNumbers: [] });
    }
    this.queues = this.queues.map((q) => (q.serviceId === s.id ? { ...q, estimatedServiceTime: s.estimatedServiceTime } : q));
    this.emit();
  }
  async saveSettings(c: CrowdSettings) { this.settings = c; this.emit(); }
  async seedDemoData() {
    this.services = [...SEED_SERVICES]; this.queues = SEED_QUEUES.map((q) => ({ ...q }));
    this.tokens = buildSeedTokens(SEED_SERVICES, SEED_QUEUES); this.emit();
  }
}
void tokenDocId;
