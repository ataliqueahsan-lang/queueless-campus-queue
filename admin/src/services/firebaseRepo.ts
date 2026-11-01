import {
  collection, doc, getDoc, onSnapshot, orderBy, query,
  Timestamp, where, type DocumentData, type DocumentSnapshot,
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { DEFAULT_CROWD } from '../types';
import type { AppUser, CrowdSettings, Queue, QueueStatus, Service, Token, TokenStatus } from '../types';
import { fb } from './firebase';
import type { AdminRepo, ServiceInput, Unsub } from './repo';

const ms = (v: unknown, fallback: number | null = null): number | null =>
  v && typeof (v as Timestamp).toMillis === 'function' ? (v as Timestamp).toMillis() : fallback;

const mapQueue = (s: DocumentSnapshot<DocumentData>): Queue => {
  const d = s.data()!;
  return {
    serviceId: s.id, currentToken: d.currentToken ?? 0, nextToken: d.nextToken ?? 1, status: d.status ?? 'OPEN',
    estimatedServiceTime: d.estimatedServiceTime ?? 3, waitingNumbers: d.waitingNumbers ?? [],
  };
};
const mapToken = (s: DocumentSnapshot<DocumentData>): Token => {
  const d = s.data()!;
  return {
    id: s.id, tokenNumber: d.tokenNumber, serviceId: d.serviceId, serviceName: d.serviceName ?? d.serviceId,
    userId: d.userId, userName: d.userName ?? 'Student', status: d.status, positionAtJoin: d.positionAtJoin ?? 1,
    createdAt: ms(d.createdAt, Date.now())!, calledAt: ms(d.calledAt), completedAt: ms(d.completedAt),
  };
};

export class FirebaseAdminRepo implements AdminRepo {
  mode = 'firebase' as const;

  onAuth(cb: (u: AppUser | null, loading: boolean) => void): Unsub {
    cb(null, true);
    return onAuthStateChanged(fb().auth, async (fu) => {
      if (!fu) return cb(null, false);
      try {
        const snap = await getDoc(doc(fb().db, 'users', fu.uid));
        const d = snap.data();
        if (d && (d.role === 'STAFF' || d.role === 'ADMIN')) {
          cb({ uid: fu.uid, name: d.name ?? 'Staff', studentId: d.studentId ?? '', email: fu.email ?? '', role: d.role }, false);
        } else { await signOut(fb().auth); cb(null, false); }
      } catch { await signOut(fb().auth); cb(null, false); }
    });
  }

  async signIn(email: string, password: string) {
    const cred = await signInWithEmailAndPassword(fb().auth, email, password);
    const snap = await getDoc(doc(fb().db, 'users', cred.user.uid));
    const role = snap.data()?.role;
    if (role !== 'STAFF' && role !== 'ADMIN') {
      await signOut(fb().auth);
      throw Object.assign(new Error('NOT_STAFF'), { code: 'NOT_STAFF' });
    }
  }
  signOut() { return signOut(fb().auth); }

  subscribeServices(cb: (s: Service[]) => void, onErr?: (e: unknown) => void): Unsub {
    return onSnapshot(collection(fb().db, 'services'), (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Service, 'id'>) }))
        .sort((a, b) => (a.order ?? 99) - (b.order ?? 99)));
    }, onErr);
  }
  subscribeQueues(cb: (q: Queue[]) => void, onErr?: (e: unknown) => void): Unsub {
    return onSnapshot(collection(fb().db, 'queues'), (snap) => cb(snap.docs.map(mapQueue)), onErr);
  }
  subscribeTodayTokens(since: number, cb: (t: Token[]) => void, onErr?: (e: unknown) => void): Unsub {
    const q = query(collection(fb().db, 'tokens'), where('createdAt', '>=', Timestamp.fromMillis(since)), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snap) => cb(snap.docs.map(mapToken)), onErr);
  }
  subscribeStudents(cb: (u: AppUser[]) => void, onErr?: (e: unknown) => void): Unsub {
    return onSnapshot(query(collection(fb().db, 'users'), where('role', '==', 'STUDENT')), (snap) =>
      cb(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<AppUser, 'uid'>) }))), onErr);
  }
  subscribeSettings(cb: (c: CrowdSettings) => void): Unsub {
    return onSnapshot(doc(fb().db, 'settings', 'crowd'), (s) => cb(s.exists() ? { ...DEFAULT_CROWD, ...(s.data() as CrowdSettings) } : DEFAULT_CROWD), () => cb(DEFAULT_CROWD));
  }

  async callToken(serviceId: string, tokenNumber: number | null, staff: AppUser) {
    void staff;
    const invoke = httpsCallable(getFunctions(), 'callToken');
    await invoke({ serviceId, tokenNumber });
  }

  async setTokenStatus(token: Token, status: TokenStatus, staff: AppUser) {
    void staff;
    const invoke = httpsCallable(getFunctions(), 'setTokenStatus');
    await invoke({ serviceId: token.serviceId, tokenNumber: token.tokenNumber, status });
  }

  async setQueueStatus(serviceId: string, status: QueueStatus) {
    const invoke = httpsCallable(getFunctions(), 'setQueueStatus');
    await invoke({ serviceId, status });
  }

  async saveService(s: ServiceInput) {
    const invoke = httpsCallable(getFunctions(), 'saveService');
    await invoke(s);
  }

  async saveSettings(c: CrowdSettings) {
    const invoke = httpsCallable(getFunctions(), 'saveSettings');
    await invoke(c);
  }

  async seedDemoData() {
    const invoke = httpsCallable(getFunctions(), 'seedDemoData');
    await invoke({});
  }
}
