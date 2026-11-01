import type { AppNotification, AppUser, CrowdSettings, Queue, Service, Token } from '@/types';
import { DEMO_MODE } from './firebase';
import { FirebaseRepo } from './firebaseRepo';
import { MockRepo } from './mockRepo';

export type Unsub = () => void;
export interface DemoControls {
  callNext(serviceId: string): void;
  completeCurrent(serviceId: string): void;
  addPeople(serviceId: string, n: number): void;
}

/** Everything the app needs from a backend. Firebase and demo mode both implement this. */
export interface Repo {
  mode: 'firebase' | 'demo';
  onAuth(cb: (u: AppUser | null, loading: boolean) => void): Unsub;
  signIn(email: string, password: string): Promise<void>;
  register(input: { name: string; studentId: string; email: string; password: string }): Promise<void>;
  signOut(): Promise<void>;
  updateProfile(uid: string, p: { name: string; studentId: string }): Promise<void>;
  subscribeServices(cb: (s: Service[]) => void, onErr?: (e: unknown) => void): Unsub;
  /** stale = true when the data comes from the offline cache */
  subscribeQueues(cb: (q: Queue[], stale: boolean) => void, onErr?: (e: unknown) => void): Unsub;
  subscribeSettings(cb: (c: CrowdSettings) => void): Unsub;
  subscribeMyTokens(uid: string, cb: (t: Token[]) => void, onErr?: (e: unknown) => void): Unsub;
  subscribeNotifications(uid: string, cb: (n: AppNotification[]) => void): Unsub;
  joinQueue(user: AppUser, serviceId: string): Promise<Token>;
  leaveQueue(token: Token): Promise<void>;
  /** id is deterministic, so the same alert is never stored twice */
  pushNotification(uid: string, id: string, n: { title: string; body: string; type: string }): Promise<void>;
  markRead(uid: string, ids: string[]): Promise<void>;
  demo?: DemoControls;
}

export const repo: Repo = DEMO_MODE ? new MockRepo() : new FirebaseRepo();
