import {
  collection, doc, getDocs, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc,
  Timestamp, where, writeBatch, type DocumentData, type DocumentSnapshot,
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getDoc } from 'firebase/firestore';
import { DEFAULT_CROWD } from '../types';
import type { AppUser, CrowdSettings, Queue, QueueStatus, Service, Token, TokenStatus } from '../types';
import { QueueError, applyCall, applyRemove, canTransition, lockDocId, tokenDocId } from '../utils/queueLogic';
import { fb } from './firebase';
import type { AdminRepo, ServiceInput, Unsub } from './repo';
import { SEED_QUEUES, SEED_SERVICES, buildSeedTokens } from './seedData';

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
      } catch { cb(null, false); }
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
    const { db } = fb();
    await runTransaction(db, async (tx) => {
      const qRef = doc(db, 'queues', serviceId);
      const qs = await tx.get(qRef);
      if (!qs.exists()) throw new QueueError('NOT_FOUND');
      const q = mapQueue(qs);
      const { queue, target } = applyCall(q, tokenNumber ?? undefined);
      const tRef = doc(db, 'tokens', tokenDocId(serviceId, target));
      const ts = await tx.get(tRef);
      if (!ts.exists()) throw new QueueError('NOT_FOUND');
      const prevRef = q.currentToken > 0 ? doc(db, 'tokens', tokenDocId(serviceId, q.currentToken)) : null;
      const ps = prevRef ? await tx.get(prevRef) : null;

      tx.update(qRef, { currentToken: queue.currentToken, waitingNumbers: queue.waitingNumbers });
      tx.update(tRef, { status: 'CALLED', calledAt: serverTimestamp() });
      // The counter moved on: the previously called/serving token is finished.
      if (prevRef && ps && ps.exists() && ['CALLED', 'SERVING'].includes(ps.data().status)) {
        tx.update(prevRef, { status: 'COMPLETED', completedAt: serverTimestamp() });
        tx.delete(doc(db, 'activeTokens', lockDocId(ps.data().userId, serviceId)));
      }
      tx.set(doc(collection(db, 'queue_events')), {
        serviceId, type: 'CALLED', tokenNumber: target, actorId: staff.uid, createdAt: serverTimestamp(),
      });
    });
  }

  async setTokenStatus(token: Token, status: TokenStatus, staff: AppUser) {
    const { db } = fb();
    await runTransaction(db, async (tx) => {
      const tRef = doc(db, 'tokens', token.id);
      const qRef = doc(db, 'queues', token.serviceId);
      const [ts, qs] = await Promise.all([tx.get(tRef), tx.get(qRef)]);
      if (!ts.exists() || !qs.exists()) throw new QueueError('NOT_FOUND');
      const cur = ts.data().status as TokenStatus;
      if (!canTransition(cur, status)) throw new QueueError('BAD_TRANSITION');
      const patch: Record<string, unknown> = { status };
      if (status === 'CALLED') patch.calledAt = serverTimestamp();
      if (['COMPLETED', 'SKIPPED', 'CANCELLED'].includes(status)) patch.completedAt = serverTimestamp();
      if (cur === 'WAITING' && (status === 'SKIPPED' || status === 'CANCELLED')) {
        tx.update(qRef, { waitingNumbers: applyRemove(mapQueue(qs), token.tokenNumber).waitingNumbers });
      }
      tx.update(tRef, patch);
      if (['COMPLETED', 'SKIPPED', 'CANCELLED'].includes(status)) {
        tx.delete(doc(db, 'activeTokens', lockDocId(ts.data().userId, token.serviceId)));
      }
      tx.set(doc(collection(db, 'queue_events')), {
        serviceId: token.serviceId, type: status, tokenNumber: token.tokenNumber, actorId: staff.uid, createdAt: serverTimestamp(),
      });
    });
  }

  async setQueueStatus(serviceId: string, status: QueueStatus) {
    await setDoc(doc(fb().db, 'queues', serviceId), { status }, { merge: true });
  }

  async saveService(s: ServiceInput) {
    const { db } = fb();
    const batch = writeBatch(db);
    const qRef = doc(db, 'queues', s.id);
    const existing = await getDoc(qRef);
    const all = await getDocs(collection(db, 'services'));
    batch.set(doc(db, 'services', s.id), { ...s, order: s.order ?? all.size + 1 }, { merge: true });
    if (existing.exists()) batch.update(qRef, { estimatedServiceTime: s.estimatedServiceTime });
    else batch.set(qRef, { serviceId: s.id, currentToken: 0, nextToken: 1, status: 'OPEN', estimatedServiceTime: s.estimatedServiceTime, waitingNumbers: [] });
    await batch.commit();
  }

  async saveSettings(c: CrowdSettings) { await setDoc(doc(fb().db, 'settings', 'crowd'), c); }

  async seedDemoData() {
    const { db } = fb();
    const batch = writeBatch(db);
    SEED_SERVICES.forEach((s) => batch.set(doc(db, 'services', s.id), s));
    SEED_QUEUES.forEach((q) => batch.set(doc(db, 'queues', q.serviceId), q));
    buildSeedTokens(SEED_SERVICES, SEED_QUEUES).forEach((t) => {
      const { id, ...rest } = t;
      batch.set(doc(db, 'tokens', id), {
        ...rest, createdAt: Timestamp.fromMillis(t.createdAt),
        calledAt: t.calledAt ? Timestamp.fromMillis(t.calledAt) : null,
        completedAt: t.completedAt ? Timestamp.fromMillis(t.completedAt) : null,
      });
    });
    batch.set(doc(db, 'settings', 'crowd'), DEFAULT_CROWD);
    await batch.commit();
  }
}
