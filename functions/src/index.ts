import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, Timestamp, type DocumentData, type DocumentReference, type DocumentSnapshot, type Transaction } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { assertDemoSeedingAllowed } from './security';

initializeApp();
const db = getFirestore();
const auth = getAuth();

type Role = 'STUDENT' | 'STAFF' | 'ADMIN';
type TokenStatus = 'WAITING' | 'CALLED' | 'SERVING' | 'COMPLETED' | 'SKIPPED' | 'CANCELLED';
type QueueStatus = 'OPEN' | 'PAUSED' | 'CLOSED';
type QueueDoc = { serviceId: string; currentToken: number; nextToken: number; status: QueueStatus; estimatedServiceTime: number; waitingNumbers: number[] };
type TokenDoc = { tokenNumber: number; serviceId: string; serviceName: string; userId: string; userName: string; status: TokenStatus; positionAtJoin: number; createdAt: unknown; calledAt: unknown; completedAt: unknown };

const transitions: Record<TokenStatus, TokenStatus[]> = {
  WAITING: ['CALLED', 'SKIPPED', 'CANCELLED'],
  CALLED: ['SERVING', 'COMPLETED', 'SKIPPED', 'CANCELLED'],
  SERVING: ['COMPLETED'],
  COMPLETED: [], SKIPPED: [], CANCELLED: [],
};
const lockId = (uid: string, serviceId: string) => `${uid}_${serviceId}`;
const tokenId = (serviceId: string, number: number) => `${serviceId}_${number}`;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const fail = (code: ConstructorParameters<typeof HttpsError>[0], message: string): never => { throw new HttpsError(code, message); };

function exactKeys(data: unknown, required: string[], optional: string[] = []): Record<string, unknown> {
  if (!isRecord(data)) return fail('invalid-argument', 'Request data must be an object.');
  const allowed = new Set([...required, ...optional]);
  if (required.some((k) => !(k in data)) || Object.keys(data).some((k) => !allowed.has(k))) {
    return fail('invalid-argument', 'Request has missing or unsupported fields.');
  }
  return data;
}
function validId(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[a-z0-9_-]{1,64}$/.test(value)) return fail('invalid-argument', `${label} is invalid.`);
  return value;
}
function validInt(value: unknown, label: string, min = 0, max = 1_000_000): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) return fail('invalid-argument', `${label} is invalid.`);
  return value as number;
}
function requireUid(uid: string | undefined): string {
  if (!uid) return fail('unauthenticated', 'Sign in is required.');
  return uid;
}
async function requireRoleIn(tx: Transaction, uid: string, roles: Role[]) {
  const snapshot = await tx.get(db.doc(`users/${uid}`));
  const profile = snapshot.data();
  if (!snapshot.exists || !profile || !roles.includes(profile.role)) fail('permission-denied', 'Your account is not authorized for this operation.');
  const verified = profile as DocumentData;
  return { role: verified.role as Role, name: typeof verified.name === 'string' ? verified.name : '' };
}
function readQueue(d: DocumentData | undefined, serviceId: string): QueueDoc {
  if (!d || d.serviceId !== serviceId || !Array.isArray(d.waitingNumbers)) return fail('failed-precondition', 'Queue data is invalid.');
  const waiting = d.waitingNumbers as unknown[];
  if (!Number.isSafeInteger(d.nextToken) || d.nextToken < 1 || !Number.isSafeInteger(d.currentToken) || d.currentToken < 0 || d.currentToken >= d.nextToken || waiting.some((n) => !Number.isSafeInteger(n) || (n as number) <= d.currentToken || (n as number) >= d.nextToken) || new Set(waiting).size !== waiting.length) {
    return fail('failed-precondition', 'Queue counters are inconsistent.');
  }
  return { serviceId, currentToken: d.currentToken, nextToken: d.nextToken, status: d.status, estimatedServiceTime: d.estimatedServiceTime ?? 3, waitingNumbers: waiting as number[] };
}
function requireWaiting(q: QueueDoc, status: QueueStatus = 'OPEN') {
  if (q.status !== status) fail('failed-precondition', `Queue is ${q.status.toLowerCase()}.`);
}
function createEvent(tx: Transaction, data: Record<string, unknown>) {
  tx.create(db.collection('queue_events').doc(), { ...data, createdAt: FieldValue.serverTimestamp() });
}
function verifyLock(d: DocumentData | undefined, uid: string, serviceId: string, id: string) {
  if (!d || d.userId !== uid || d.serviceId !== serviceId || d.tokenId !== id) fail('failed-precondition', 'Active-token lock is inconsistent.');
}

export const joinQueue = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const input = exactKeys(request.data, ['serviceId']);
  const serviceId = validId(input.serviceId, 'serviceId');
  const qRef = db.doc(`queues/${serviceId}`);
  const serviceRef = db.doc(`services/${serviceId}`);
  const lockRef = db.doc(`activeTokens/${lockId(uid, serviceId)}`);
  const activeQuery = db.collection('tokens').where('userId', '==', uid).where('serviceId', '==', serviceId).where('status', 'in', ['WAITING', 'CALLED', 'SERVING']).limit(1);
  const result = await db.runTransaction(async (tx) => {
    const [profile, qs, ss, ls, active] = await Promise.all([
      requireRoleIn(tx, uid, ['STUDENT']), tx.get(qRef), tx.get(serviceRef), tx.get(lockRef), tx.get(activeQuery),
    ]);
    if (!qs.exists || !ss.exists || ss.data()?.active !== true) fail('not-found', 'This service is not available.');
    if (ls.exists || !active.empty) fail('already-exists', 'You already have an active token for this service.');
    const q = readQueue(qs.data(), serviceId);
    if (!['OPEN', 'PAUSED', 'CLOSED'].includes(q.status)) fail('failed-precondition', 'Queue status is invalid.');
    requireWaiting(q);
    const number = q.nextToken;
    const id = tokenId(serviceId, number);
    const tRef = db.doc(`tokens/${id}`);
    const ts = await tx.get(tRef);
    if (ts.exists) fail('already-exists', 'This token number has already been used.');
    const name = profile.name || 'Student';
    const body: TokenDoc = {
      tokenNumber: number, serviceId, serviceName: String(ss.data()?.name ?? serviceId),
      userId: uid, userName: name, status: 'WAITING', positionAtJoin: q.waitingNumbers.length + 1,
      createdAt: FieldValue.serverTimestamp(), calledAt: null, completedAt: null,
    };
    tx.update(qRef, { nextToken: number + 1, waitingNumbers: [...q.waitingNumbers, number] });
    tx.create(tRef, body);
    tx.create(lockRef, { userId: uid, serviceId, tokenId: id, createdAt: FieldValue.serverTimestamp() });
    createEvent(tx, { serviceId, type: 'JOINED', tokenNumber: number, actorId: uid });
    return { id, ...body, createdAt: Date.now() };
  });
  return result;
});

export const cancelQueue = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const input = exactKeys(request.data, ['serviceId', 'tokenNumber']);
  const serviceId = validId(input.serviceId, 'serviceId');
  const number = validInt(input.tokenNumber, 'tokenNumber', 1);
  const id = tokenId(serviceId, number);
  const qRef = db.doc(`queues/${serviceId}`), tRef = db.doc(`tokens/${id}`), lRef = db.doc(`activeTokens/${lockId(uid, serviceId)}`);
  await db.runTransaction(async (tx) => {
    const [role, qs, ts, ls] = await Promise.all([requireRoleIn(tx, uid, ['STUDENT']), tx.get(qRef), tx.get(tRef), tx.get(lRef)]);
    void role;
    if (!qs.exists || !ts.exists) fail('not-found', 'Token or queue was not found.');
    const t = ts.data() as TokenDoc;
    const q = readQueue(qs.data(), serviceId);
    if (t.userId !== uid) fail('permission-denied', 'This token does not belong to you.');
    if (t.serviceId !== serviceId || t.tokenNumber !== number || t.status !== 'WAITING') fail('failed-precondition', 'Only a waiting token can be cancelled.');
    if (!q.waitingNumbers.includes(number)) fail('failed-precondition', 'Queue and token state are inconsistent.');
    verifyLock(ls.data(), uid, serviceId, id);
    tx.update(qRef, { waitingNumbers: q.waitingNumbers.filter((n) => n !== number) });
    tx.update(tRef, { status: 'CANCELLED', completedAt: FieldValue.serverTimestamp() });
    tx.delete(lRef);
    createEvent(tx, { serviceId, type: 'CANCELLED', tokenNumber: number, actorId: uid });
  });
  return { ok: true };
});

export const callToken = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const input = exactKeys(request.data, ['serviceId'], ['tokenNumber']);
  const serviceId = validId(input.serviceId, 'serviceId');
  const explicit = input.tokenNumber == null ? null : validInt(input.tokenNumber, 'tokenNumber', 1);
  const qRef = db.doc(`queues/${serviceId}`);
  const result = await db.runTransaction(async (tx) => {
    const [role, qs] = await Promise.all([requireRoleIn(tx, uid, ['STAFF', 'ADMIN']), tx.get(qRef)]);
    void role;
    if (!qs.exists) fail('not-found', 'Queue was not found.');
    const q = readQueue(qs.data(), serviceId);
    requireWaiting(q);
    const number = explicit ?? (q.waitingNumbers.length ? Math.min(...q.waitingNumbers) : null);
    if (number === null || !q.waitingNumbers.includes(number)) fail('failed-precondition', 'The selected token is not waiting.');
    const targetNumber = number as number;
    const targetRef = db.doc(`tokens/${tokenId(serviceId, targetNumber)}`);
    const ts = await tx.get(targetRef);
    if (!ts.exists) fail('failed-precondition', 'The waiting token is missing.');
    const target = ts.data() as TokenDoc;
    if (target.status !== 'WAITING' || target.serviceId !== serviceId || target.tokenNumber !== targetNumber) fail('failed-precondition', 'Token state is inconsistent.');
    const prevRef = q.currentToken > 0 && q.currentToken !== targetNumber ? db.doc(`tokens/${tokenId(serviceId, q.currentToken)}`) : null;
    const ps = prevRef ? await tx.get(prevRef) : null;
    let prevLockRef: DocumentReference | null = null;
    let prevLock: DocumentSnapshot | null = null;
    if (prevRef && ps?.exists && ['CALLED', 'SERVING'].includes(ps.data()?.status)) {
      prevLockRef = db.doc(`activeTokens/${lockId(String(ps.data()?.userId), serviceId)}`);
      prevLock = await tx.get(prevLockRef);
      verifyLock(prevLock.data(), String(ps.data()?.userId), serviceId, prevRef.id);
    }
    tx.update(qRef, { currentToken: targetNumber, waitingNumbers: q.waitingNumbers.filter((n) => n !== targetNumber) });
    tx.update(targetRef, { status: 'CALLED', calledAt: FieldValue.serverTimestamp() });
    if (prevRef && ps?.exists && ['CALLED', 'SERVING'].includes(ps.data()?.status)) {
      tx.update(prevRef, { status: 'COMPLETED', completedAt: FieldValue.serverTimestamp() });
      tx.delete(prevLockRef!);
    }
    createEvent(tx, { serviceId, type: 'CALLED', tokenNumber: targetNumber, actorId: uid });
    return { ok: true, tokenNumber: targetNumber };
  });
  return result;
});

export const setTokenStatus = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const input = exactKeys(request.data, ['serviceId', 'tokenNumber', 'status']);
  const serviceId = validId(input.serviceId, 'serviceId');
  const number = validInt(input.tokenNumber, 'tokenNumber', 1);
  const status = input.status as TokenStatus;
  if (!['SERVING', 'COMPLETED', 'SKIPPED'].includes(status)) fail('invalid-argument', 'Requested status is not a staff action.');
  const id = tokenId(serviceId, number), qRef = db.doc(`queues/${serviceId}`), tRef = db.doc(`tokens/${id}`);
  await db.runTransaction(async (tx) => {
    const [role, qs, ts] = await Promise.all([requireRoleIn(tx, uid, ['STAFF', 'ADMIN']), tx.get(qRef), tx.get(tRef)]);
    void role;
    if (!qs.exists || !ts.exists) fail('not-found', 'Token or queue was not found.');
    const q = readQueue(qs.data(), serviceId), t = ts.data() as TokenDoc;
    if (t.serviceId !== serviceId || t.tokenNumber !== number || !transitions[t.status]?.includes(status)) fail('failed-precondition', 'Token status transition is not allowed.');
    if (t.status === 'WAITING' && !q.waitingNumbers.includes(number)) fail('failed-precondition', 'Queue and token state are inconsistent.');
    const lRef = db.doc(`activeTokens/${lockId(t.userId, serviceId)}`);
    const ls = ['COMPLETED', 'SKIPPED'].includes(status) ? await tx.get(lRef) : null;
    if (['COMPLETED', 'SKIPPED'].includes(status)) verifyLock(ls?.data(), t.userId, serviceId, id);
    if (t.status === 'WAITING' && status === 'SKIPPED') tx.update(qRef, { waitingNumbers: q.waitingNumbers.filter((n) => n !== number) });
    const patch: Record<string, unknown> = { status };
    if (status === 'SERVING') patch.calledAt = t.calledAt ?? FieldValue.serverTimestamp();
    if (status === 'COMPLETED' || status === 'SKIPPED') patch.completedAt = FieldValue.serverTimestamp();
    tx.update(tRef, patch);
    if (['COMPLETED', 'SKIPPED'].includes(status)) tx.delete(lRef);
    createEvent(tx, { serviceId, type: status, tokenNumber: number, actorId: uid });
  });
  return { ok: true };
});

export const setQueueStatus = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const input = exactKeys(request.data, ['serviceId', 'status']);
  const serviceId = validId(input.serviceId, 'serviceId');
  if (!['OPEN', 'PAUSED', 'CLOSED'].includes(String(input.status))) fail('invalid-argument', 'Queue status is invalid.');
  const qRef = db.doc(`queues/${serviceId}`);
  await db.runTransaction(async (tx) => {
    const [role, qs] = await Promise.all([requireRoleIn(tx, uid, ['STAFF', 'ADMIN']), tx.get(qRef)]);
    void role;
    if (!qs.exists) fail('not-found', 'Queue was not found.');
    readQueue(qs.data(), serviceId);
    tx.update(qRef, { status: input.status });
    createEvent(tx, { serviceId, type: `QUEUE_${input.status}`, actorId: uid });
  });
  return { ok: true };
});

export const saveService = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const input = exactKeys(request.data, ['id', 'name', 'icon', 'description', 'estimatedServiceTime', 'active'], ['order']);
  const id = validId(input.id, 'id');
  if (typeof input.name !== 'string' || input.name.trim().length < 2 || input.name.length > 100) fail('invalid-argument', 'Service name is invalid.');
  if (typeof input.icon !== 'string' || input.icon.length > 8 || typeof input.description !== 'string' || input.description.length > 500 || typeof input.active !== 'boolean') fail('invalid-argument', 'Service fields are invalid.');
  const name = input.name as string, icon = input.icon as string, description = input.description as string, active = input.active as boolean;
  const minutes = validInt(input.estimatedServiceTime, 'estimatedServiceTime', 1, 60);
  const serviceRef = db.doc(`services/${id}`), qRef = db.doc(`queues/${id}`);
  await db.runTransaction(async (tx) => {
    const [role, ss, qs] = await Promise.all([requireRoleIn(tx, uid, ['ADMIN']), tx.get(serviceRef), tx.get(qRef)]);
    void role;
    const order = input.order == null ? (ss.exists ? (ss.data()?.order ?? 99) : 99) : validInt(input.order, 'order', 1, 9999);
    tx.set(serviceRef, { id, name: name.trim(), icon, description: description.trim(), estimatedServiceTime: minutes, active, order }, { merge: true });
    if (!qs.exists) tx.create(qRef, { serviceId: id, currentToken: 0, nextToken: 1, status: 'OPEN', estimatedServiceTime: minutes, waitingNumbers: [] });
    else tx.update(qRef, { estimatedServiceTime: minutes });
    createEvent(tx, { serviceId: id, type: 'SERVICE_SAVED', actorId: uid });
  });
  return { ok: true };
});

export const saveSettings = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const input = exactKeys(request.data, ['lowMax', 'moderateMax']);
  const lowMax = validInt(input.lowMax, 'lowMax', 0, 1000), moderateMax = validInt(input.moderateMax, 'moderateMax', 1, 1000);
  if (moderateMax <= lowMax) fail('invalid-argument', 'Moderate threshold must be greater than low threshold.');
  await db.runTransaction(async (tx) => {
    await requireRoleIn(tx, uid, ['ADMIN']);
    tx.set(db.doc('settings/crowd'), { lowMax, moderateMax });
    createEvent(tx, { serviceId: 'settings', type: 'SETTINGS_UPDATED', actorId: uid });
  });
  return { ok: true };
});

export const provisionUserRole = onCall(async (request) => {
  const actorUid = requireUid(request.auth?.uid);
  const input = exactKeys(request.data, ['uid', 'role']);
  if (typeof input.uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(input.uid)) fail('invalid-argument', 'User UID is invalid.');
  if (!['STUDENT', 'STAFF', 'ADMIN'].includes(String(input.role))) fail('invalid-argument', 'Role is invalid.');
  const targetUid = input.uid as string, role = input.role as Role;
  // Authorize before querying Auth so non-admins cannot use this callable as a UID oracle.
  await db.runTransaction(async (tx) => { await requireRoleIn(tx, actorUid, ['ADMIN']); });
  try {
    const target = await auth.getUser(targetUid);
    if (target.disabled) fail('failed-precondition', 'Disabled accounts cannot be provisioned.');
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    fail('not-found', 'Authentication user was not found.');
  }
  const ref = db.doc(`users/${targetUid}`);
  await db.runTransaction(async (tx) => {
    const [actor, s] = await Promise.all([requireRoleIn(tx, actorUid, ['ADMIN']), tx.get(ref)]);
    void actor;
    if (!s.exists) fail('not-found', 'User profile was not found.');
    const previousRole = s.data()?.role;
    tx.update(ref, { role });
    createEvent(tx, { serviceId: 'users', type: 'ROLE_CHANGED', actorId: actorUid, targetUid, previousRole, role });
  });
  return { ok: true };
});

export const createNotification = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const input = exactKeys(request.data, ['tokenId', 'kind']);
  const id = validId(input.tokenId, 'tokenId');
  const kind = input.kind;
  if (!['joined', 'soon', 'next', 'called', 'completed', 'skipped'].includes(String(kind))) fail('invalid-argument', 'Notification kind is invalid.');
  const tRef = db.doc(`tokens/${id}`);
  const notificationId = `${id}_${kind}`;
  const notificationRef = db.doc(`notifications/${notificationId}`);
  const initial = await tRef.get();
  if (!initial.exists) fail('not-found', 'Token was not found.');
  const serviceId = validId(initial.data()?.serviceId, 'token serviceId');
  const qRef = db.doc(`queues/${serviceId}`);
  const outcome = await db.runTransaction(async (tx) => {
    await requireRoleIn(tx, uid, ['STUDENT']);
    const [ts, qs, existing] = await Promise.all([tx.get(tRef), tx.get(qRef), tx.get(notificationRef)]);
    if (!ts.exists) fail('not-found', 'Token was not found.');
    const token = ts.data() as TokenDoc;
    if (token.userId !== uid) fail('permission-denied', 'This token does not belong to you.');
    if (existing.exists) return { ok: true };
    let title = '', body = '';
    if (token.status === 'WAITING' && ['joined', 'soon', 'next'].includes(String(kind))) {
      const q = readQueue(qs.data(), serviceId);
      const position = q.waitingNumbers.filter((n) => n < token.tokenNumber).length + 1;
      if ((kind === 'next' && position !== 1) || (kind === 'soon' && (position < 2 || position > 3)) || (kind === 'joined' && position <= 3)) return { ok: true, skipped: true };
      if (kind === 'joined') [title, body] = ['You’re in the queue', 'You’re in the queue. We’ll notify you when your turn gets closer.'];
      if (kind === 'soon') [title, body] = ['Your turn is coming!', 'Your turn is coming! Please get ready.'];
      if (kind === 'next') [title, body] = ['You’re next!', 'You’re next! Please go to the counter.'];
    } else if (token.status === 'CALLED' && kind === 'called') [title, body] = ['It’s your turn', `Your token #${token.tokenNumber} is now being served. Please go to the counter.`];
    else if (token.status === 'COMPLETED' && kind === 'completed') [title, body] = ['Token completed', 'Your QueueLess token has been completed. Thank you!'];
    else if (token.status === 'SKIPPED' && kind === 'skipped') [title, body] = ['Token skipped', `Your token #${token.tokenNumber} was skipped. You can join the queue again any time.`];
    else return { ok: true, skipped: true };
    tx.create(notificationRef, { userId: uid, title, body, type: kind, read: false, createdAt: FieldValue.serverTimestamp() });
    return { ok: true };
  });
  return outcome;
});

const demoServices = [
  { id: 'canteen', name: 'Canteen', icon: '🍔', description: 'Meals, snacks and beverages', estimatedServiceTime: 2, order: 1, active: true },
  { id: 'library', name: 'Library', icon: '📚', description: 'Book issue, returns and desk help', estimatedServiceTime: 3, order: 2, active: true },
  { id: 'office', name: 'Office', icon: '🏢', description: 'Admissions, fees and certificates', estimatedServiceTime: 5, order: 3, active: true },
  { id: 'laboratory', name: 'Laboratory', icon: '🧪', description: 'Lab slots and equipment issue', estimatedServiceTime: 4, order: 4, active: true },
];
const demoQueues = [
  { serviceId: 'canteen', currentToken: 9, nextToken: 12, status: 'OPEN', estimatedServiceTime: 2, waitingNumbers: [10, 11] },
  { serviceId: 'library', currentToken: 24, nextToken: 30, status: 'OPEN', estimatedServiceTime: 3, waitingNumbers: [25, 26, 27, 28, 29] },
  { serviceId: 'office', currentToken: 4, nextToken: 8, status: 'PAUSED', estimatedServiceTime: 5, waitingNumbers: [5, 6, 7] },
  { serviceId: 'laboratory', currentToken: 30, nextToken: 47, status: 'OPEN', estimatedServiceTime: 4, waitingNumbers: Array.from({ length: 16 }, (_, i) => 31 + i) },
];
const demoNames = ['Rahul', 'Ahsan', 'Priya', 'Neha', 'Arjun', 'Sana', 'Vikram', 'Meera', 'Kabir', 'Isha', 'Dev', 'Anaya', 'Rohan', 'Zoya', 'Kiran', 'Tara'];
export const seedDemoData = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  await db.runTransaction(async (tx) => {
    await requireRoleIn(tx, uid, ['ADMIN']);
    assertDemoSeedingAllowed(process.env);
    const markerRef = db.doc('settings/demo_data');
    const [marker, existingQueues, existingServices, existingTokens] = await Promise.all([
      tx.get(markerRef), tx.get(db.collection('queues')), tx.get(db.collection('services')), tx.get(db.collection('tokens')),
    ]);
    const demoIds = new Set(demoServices.map((service) => service.id));
    if (!marker.exists && (!existingQueues.empty || !existingServices.empty || !existingTokens.empty)) fail('failed-precondition', 'Demo data can only be initialized in an empty Firebase project.');
    if (existingQueues.docs.some((snapshot) => !demoIds.has(snapshot.id)) || existingServices.docs.some((snapshot) => !demoIds.has(snapshot.id)) || existingTokens.docs.some((snapshot) => !String(snapshot.data().userId).startsWith('demo-user-'))) {
      fail('failed-precondition', 'Live or non-demo Firebase data prevents resetting the demo data.');
    }
    demoServices.forEach((service) => tx.set(db.doc(`services/${service.id}`), service));
    demoQueues.forEach((queue) => tx.set(db.doc(`queues/${queue.serviceId}`), queue));
    let index = 0;
    const serviceName = (serviceId: string) => demoServices.find((service) => service.id === serviceId)?.name ?? serviceId;
    for (const queue of demoQueues) {
      for (let i = 0; i < queue.waitingNumbers.length; i++) {
        const number = queue.waitingNumbers[i], userId = `demo-user-${index}`;
        const id = tokenId(queue.serviceId, number);
        tx.set(db.doc(`tokens/${id}`), { tokenNumber: number, serviceId: queue.serviceId, serviceName: serviceName(queue.serviceId), userId, userName: demoNames[index++ % demoNames.length], status: 'WAITING', positionAtJoin: i + 1, createdAt: Timestamp.now(), calledAt: null, completedAt: null });
        tx.set(db.doc(`activeTokens/${lockId(userId, queue.serviceId)}`), { userId, serviceId: queue.serviceId, tokenId: id, createdAt: FieldValue.serverTimestamp() });
      }
      for (let k = 0; k < 6; k++) {
        const number = queue.currentToken - 1 - k;
        if (number <= 0) continue;
        const createdAt = Timestamp.fromMillis(Date.now() - (2 + k) * 45 * 60_000);
        const calledAt = Timestamp.fromMillis(createdAt.toMillis() + (3 + k) * 60_000);
        const id = tokenId(queue.serviceId, number);
        tx.set(db.doc(`tokens/${id}`), { tokenNumber: number, serviceId: queue.serviceId, serviceName: serviceName(queue.serviceId), userId: `demo-user-${index}`, userName: demoNames[index++ % demoNames.length], status: 'COMPLETED', positionAtJoin: 3, createdAt, calledAt, completedAt: Timestamp.fromMillis(calledAt.toMillis() + queue.estimatedServiceTime * 60_000) });
      }
    }
    tx.set(db.doc('settings/crowd'), { lowMax: 5, moderateMax: 15 });
    tx.set(markerRef, { version: 1, updatedAt: FieldValue.serverTimestamp() });
    createEvent(tx, { serviceId: 'system', type: 'DEMO_DATA_LOADED', actorId: uid });
  });
  return { ok: true };
});
