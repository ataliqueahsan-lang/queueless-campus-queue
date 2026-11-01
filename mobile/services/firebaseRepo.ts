import {
  createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut,
} from 'firebase/auth';
import {
  collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, Timestamp, updateDoc,
  where, writeBatch, type DocumentData, type DocumentSnapshot,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { DEFAULT_CROWD } from '@/types';
import type { AppNotification, AppUser, CrowdSettings, Queue, Service, Token } from '@/types';
import { QueueError } from '@/utils/queueLogic';
import { fb } from './firebase';
import type { Repo, Unsub } from './repo';

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
    // serverTimestamp() is null for a moment on the device that just wrote it
    createdAt: ms(d.createdAt, Date.now())!, calledAt: ms(d.calledAt), completedAt: ms(d.completedAt),
  };
};

export class FirebaseRepo implements Repo {
  mode = 'firebase' as const;

  onAuth(cb: (u: AppUser | null, loading: boolean) => void): Unsub {
    cb(null, true);
    return onAuthStateChanged(fb().auth, async (fu) => {
      if (!fu) return cb(null, false);
      try {
        const snap = await getDoc(doc(fb().db, 'users', fu.uid));
        const d = snap.data();
        if (!snap.exists() || d?.role !== 'STUDENT') {
          await signOut(fb().auth);
          return cb(null, false);
        }
        cb({ uid: fu.uid, name: d.name ?? fu.displayName ?? 'Student', studentId: d.studentId ?? '', email: fu.email ?? '', role: 'STUDENT' }, false);
      } catch {
        // Fail closed: role-sensitive reads and functions require a verified profile.
        await signOut(fb().auth).catch(() => undefined);
        cb(null, false);
      }
    });
  }

  async signIn(email: string, password: string) { await signInWithEmailAndPassword(fb().auth, email, password); }

  async register({ name, studentId, email, password }: { name: string; studentId: string; email: string; password: string }) {
    const cred = await createUserWithEmailAndPassword(fb().auth, email, password);
    // role is always STUDENT here; the security rules refuse anything else.
    await setDoc(doc(fb().db, 'users', cred.user.uid), { name, studentId, email: cred.user.email ?? email, role: 'STUDENT', createdAt: serverTimestamp() });
  }
  signOut() { return signOut(fb().auth); }
  async updateProfile(uid: string, p: { name: string; studentId: string }) { await updateDoc(doc(fb().db, 'users', uid), p); }

  subscribeServices(cb: (s: Service[]) => void, onErr?: (e: unknown) => void): Unsub {
    return onSnapshot(collection(fb().db, 'services'), (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Service, 'id'>) })).sort((a, b) => (a.order ?? 99) - (b.order ?? 99)));
    }, onErr);
  }
  subscribeQueues(cb: (q: Queue[], stale: boolean) => void, onErr?: (e: unknown) => void): Unsub {
    return onSnapshot(collection(fb().db, 'queues'), { includeMetadataChanges: true }, (snap) => {
      cb(snap.docs.map(mapQueue), snap.metadata.fromCache && !snap.metadata.hasPendingWrites);
    }, onErr);
  }
  subscribeSettings(cb: (c: CrowdSettings) => void): Unsub {
    return onSnapshot(doc(fb().db, 'settings', 'crowd'),
      (s) => cb(s.exists() ? { ...DEFAULT_CROWD, ...(s.data() as CrowdSettings) } : DEFAULT_CROWD), () => cb(DEFAULT_CROWD));
  }
  subscribeMyTokens(uid: string, cb: (t: Token[]) => void, onErr?: (e: unknown) => void): Unsub {
    return onSnapshot(query(collection(fb().db, 'tokens'), where('userId', '==', uid)), (snap) => cb(snap.docs.map(mapToken)), onErr);
  }
  subscribeNotifications(uid: string, cb: (n: AppNotification[]) => void): Unsub {
    return onSnapshot(query(collection(fb().db, 'notifications'), where('userId', '==', uid)), (snap) => {
      cb(snap.docs.map((d) => {
        const x = d.data();
        return { id: d.id, userId: x.userId, title: x.title, body: x.body, type: x.type, read: !!x.read, createdAt: ms(x.createdAt, Date.now())! };
      }).sort((a, b) => b.createdAt - a.createdAt));
    }, () => cb([]));
  }

  /**
   * Token generation. Everything happens inside ONE Firestore transaction:
   * read queue counter + the student's "active token" lock, then write the new counter,
   * the token and the lock together. Firestore retries the transaction if two students
   * collide, so two students can never get the same number, and one student can never
   * hold two active tokens for the same service.
   */
  async joinQueue(user: AppUser, serviceId: string): Promise<Token> {
    const { auth } = fb();
    if (auth.currentUser?.uid !== user.uid) throw new QueueError('NOT_FOUND');
    const invoke = httpsCallable<{ serviceId: string }, Omit<Token, 'createdAt'> & { createdAt: number }>(getFunctions(), 'joinQueue');
    return (await invoke({ serviceId })).data;
  }

  async leaveQueue(token: Token) {
    const invoke = httpsCallable<{ serviceId: string; tokenNumber: number }, { ok: boolean }>(getFunctions(), 'cancelQueue');
    await invoke({ serviceId: token.serviceId, tokenNumber: token.tokenNumber });
  }

  async pushNotification(uid: string, id: string, n: { title: string; body: string; type: string }) {
    const { auth } = fb();
    if (auth.currentUser?.uid !== uid) throw new QueueError('NOT_FOUND');
    const suffix = `_${n.type}`;
    if (!id.endsWith(suffix)) throw new QueueError('BAD_TRANSITION');
    const tokenId = id.slice(0, -suffix.length);
    const invoke = httpsCallable<{ tokenId: string; kind: string }, { ok: boolean; skipped?: boolean }>(getFunctions(), 'createNotification');
    await invoke({ tokenId, kind: n.type });
  }
  async markRead(_uid: string, ids: string[]) {
    const batch = writeBatch(fb().db);
    ids.forEach((id) => batch.update(doc(fb().db, 'notifications', id), { read: true }));
    await batch.commit();
  }
}
