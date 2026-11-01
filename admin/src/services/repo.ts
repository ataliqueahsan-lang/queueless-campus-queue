import type { AppUser, CrowdSettings, Queue, QueueStatus, Service, Token, TokenStatus } from '../types';
import { DEMO_MODE } from './firebase';
import { FirebaseAdminRepo } from './firebaseRepo';
import { MockAdminRepo } from './mockRepo';

export type Unsub = () => void;
export type ServiceInput = Omit<Service, 'order'> & { order?: number };

export interface AdminRepo {
  mode: 'firebase' | 'demo';
  onAuth(cb: (u: AppUser | null, loading: boolean) => void): Unsub;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  subscribeServices(cb: (s: Service[]) => void, onErr?: (e: unknown) => void): Unsub;
  subscribeQueues(cb: (q: Queue[]) => void, onErr?: (e: unknown) => void): Unsub;
  subscribeTodayTokens(sinceMs: number, cb: (t: Token[]) => void, onErr?: (e: unknown) => void): Unsub;
  subscribeStudents(cb: (u: AppUser[]) => void, onErr?: (e: unknown) => void): Unsub;
  subscribeSettings(cb: (c: CrowdSettings) => void): Unsub;
  /** tokenNumber omitted = call the next waiting token */
  callToken(serviceId: string, tokenNumber: number | null, staff: AppUser): Promise<void>;
  setTokenStatus(token: Token, status: TokenStatus, staff: AppUser): Promise<void>;
  setQueueStatus(serviceId: string, status: QueueStatus): Promise<void>;
  saveService(s: ServiceInput): Promise<void>;
  saveSettings(c: CrowdSettings): Promise<void>;
  seedDemoData(): Promise<void>;
}

export const repo: AdminRepo = DEMO_MODE ? new MockAdminRepo() : new FirebaseAdminRepo();
