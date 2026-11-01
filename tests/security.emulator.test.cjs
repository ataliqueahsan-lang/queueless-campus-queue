const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } = require('firebase/firestore');
const { assertDemoSeedingAllowed } = require('../functions/lib/security');

const projectId = 'demo-queueless';
const root = path.resolve(__dirname, '..');
let env;
let users;

async function signUp(email) {
  const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'Passw0rd-test', returnSecureToken: true }),
  });
  const data = await response.json();
  assert.equal(response.ok, true, JSON.stringify(data.error ?? data));
  return { uid: data.localId, email, idToken: data.idToken };
}

function dbFor(account) {
  return account ? env.authenticatedContext(account.uid, { email: account.email }).firestore() : env.unauthenticatedContext().firestore();
}

async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [name, role] of [['student', 'STUDENT'], ['otherStudent', 'STUDENT'], ['staff', 'STAFF'], ['admin', 'ADMIN']]) {
      const account = users[name];
      await setDoc(doc(db, 'users', account.uid), { uid: account.uid, name, studentId: `ID-${name}`, email: account.email, role, createdAt: new Date() });
    }
    await setDoc(doc(db, 'services', 'canteen'), { id: 'canteen', name: 'Canteen', icon: '🍔', description: 'Food', estimatedServiceTime: 2, active: true, order: 1 });
    await setDoc(doc(db, 'queues', 'canteen'), { serviceId: 'canteen', currentToken: 0, nextToken: 2, status: 'OPEN', estimatedServiceTime: 2, waitingNumbers: [1] });
    const token = { tokenNumber: 1, serviceId: 'canteen', serviceName: 'Canteen', userId: users.student.uid, userName: 'student', status: 'WAITING', positionAtJoin: 1, createdAt: new Date(), calledAt: null, completedAt: null };
    await setDoc(doc(db, 'tokens', 'canteen_1'), token);
    await setDoc(doc(db, 'activeTokens', `${users.student.uid}_canteen`), { userId: users.student.uid, serviceId: 'canteen', tokenId: 'canteen_1', createdAt: new Date() });
    await setDoc(doc(db, 'tokens', 'canteen_99'), { ...token, tokenNumber: 99, userId: users.otherStudent.uid, userName: 'otherStudent', status: 'COMPLETED' });
    await setDoc(doc(db, 'notifications', 'private_note'), { userId: users.student.uid, title: 'Test', body: 'Test', type: 'joined', read: false, createdAt: new Date() });
    await setDoc(doc(db, 'settings', 'crowd'), { lowMax: 5, moderateMax: 15 });
  });
}

async function call(name, data, account) {
  const headers = { 'content-type': 'application/json' };
  if (account) headers.authorization = `Bearer ${account.idToken}`;
  const response = await fetch(`http://127.0.0.1:5001/${projectId}/us-central1/${name}`, {
    method: 'POST', headers, body: JSON.stringify({ data }),
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { error: { message: text } }; }
  if (!response.ok || body.error) {
    const error = new Error(body.error?.message ?? `Function request failed (${response.status})`);
    error.status = body.error?.status;
    throw error;
  }
  return body.result;
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1', port: 8080,
      rules: fs.readFileSync(path.join(root, 'firebase/firestore.rules'), 'utf8'),
    },
  });
  users = {
    student: await signUp('student@example.test'),
    otherStudent: await signUp('other@example.test'),
    staff: await signUp('staff@example.test'),
    admin: await signUp('admin@example.test'),
  };
});

after(async () => { if (env) await env.cleanup(); });

test('QueueLess Auth, Firestore rules, and callable Functions authorization', async (t) => {
  await t.test('demo seeding requires both the emulator and explicit development opt-in', () => {
    assert.doesNotThrow(() => assertDemoSeedingAllowed({ FUNCTIONS_EMULATOR: 'true', QUEUELESS_ALLOW_DEMO_SEED: 'true' }));
    assert.throws(() => assertDemoSeedingAllowed({}), (error) => error.code === 'permission-denied');
    assert.throws(() => assertDemoSeedingAllowed({ QUEUELESS_ALLOW_DEMO_SEED: 'true' }), (error) => error.code === 'permission-denied');
    assert.throws(() => assertDemoSeedingAllowed({ FUNCTIONS_EMULATOR: 'true' }), (error) => error.code === 'permission-denied');
  });

  await t.test('unauthenticated users cannot read data or invoke mutations', async () => {
    await seed();
    const db = dbFor(null);
    await assertFails(getDoc(doc(db, 'services/canteen')));
    await assert.rejects(call('joinQueue', { serviceId: 'canteen' }), (e) => e.status === 'UNAUTHENTICATED');
  });

  await t.test('students have scoped reads and cannot write queue, token, lock, event, or role data', async () => {
    await seed();
    const db = dbFor(users.student);
    await assertSucceeds(getDoc(doc(db, `users/${users.student.uid}`)));
    await assertFails(getDoc(doc(db, `users/${users.otherStudent.uid}`)));
    await assertFails(getDoc(doc(db, 'tokens/canteen_99')));
    const ownTokens = await assertSucceeds(getDocs(query(collection(db, 'tokens'), where('userId', '==', users.student.uid))));
    assert.equal(ownTokens.size, 1);
    await assertSucceeds(getDoc(doc(db, 'services/canteen')));
    await assertFails(updateDoc(doc(db, 'queues/canteen'), { nextToken: 50, waitingNumbers: [1, 49] }));
    await assertFails(setDoc(doc(db, 'tokens/canteen_50'), { userId: users.student.uid, status: 'WAITING' }));
    await assertFails(setDoc(doc(db, 'activeTokens', `${users.student.uid}_library`), { userId: users.student.uid, serviceId: 'library', tokenId: 'library_1' }));
    await assertFails(deleteDoc(doc(db, 'activeTokens', `${users.student.uid}_canteen`)));
    await assertFails(setDoc(doc(db, 'queue_events/fake'), { type: 'ADMIN', actorId: users.student.uid }));
    await assertFails(updateDoc(doc(db, `users/${users.student.uid}`), { role: 'ADMIN' }));
    await assertSucceeds(updateDoc(doc(db, `users/${users.student.uid}`), { name: 'Student Updated' }));
    const newStudent = await signUp('new-student@example.test');
    const newDb = dbFor(newStudent);
    await assertSucceeds(setDoc(doc(newDb, `users/${newStudent.uid}`), {
      name: 'New Student', studentId: 'NEW-001', email: newStudent.email, role: 'STUDENT', createdAt: serverTimestamp(),
    }));
    const attacker = await signUp('role-attempt@example.test');
    await assertFails(setDoc(doc(dbFor(attacker), `users/${attacker.uid}`), {
      name: 'Role Attempt', studentId: 'NEW-002', email: attacker.email, role: 'ADMIN', createdAt: serverTimestamp(),
    }));
  });

  await t.test('joinQueue atomically creates the counter, token, lock, and server-attributed event; duplicate and forged requests fail', async () => {
    await seed();
    const joiningUser = users.otherStudent;
    const db = dbFor(joiningUser);
    await assertFails(updateDoc(doc(db, 'queues/canteen'), { nextToken: 3, waitingNumbers: [1, 2] }));
    await assert.rejects(call('joinQueue', { serviceId: 'canteen', userId: users.otherStudent.uid }, users.student), (e) => e.status === 'INVALID_ARGUMENT');
    const created = await call('joinQueue', { serviceId: 'canteen' }, joiningUser);
    assert.equal(created.id, 'canteen_2');
    await env.withSecurityRulesDisabled(async (context) => {
      const dbAdmin = context.firestore();
      const [q, token, lock, events] = await Promise.all([
        getDoc(doc(dbAdmin, 'queues/canteen')),
        getDoc(doc(dbAdmin, 'tokens/canteen_2')),
        getDoc(doc(dbAdmin, 'activeTokens', `${joiningUser.uid}_canteen`)),
        getDocs(collection(dbAdmin, 'queue_events')),
      ]);
      assert.equal(q.data().nextToken, 3);
      assert.deepEqual(q.data().waitingNumbers, [1, 2]);
      assert.equal(token.data().userId, joiningUser.uid);
      assert.equal(lock.data().tokenId, 'canteen_2');
      assert.ok(events.docs.some((e) => e.data().type === 'JOINED' && e.data().actorId === joiningUser.uid));
    });
    await assert.rejects(call('joinQueue', { serviceId: 'canteen' }, joiningUser), (e) => e.status === 'ALREADY_EXISTS');
    await assert.rejects(call('joinQueue', { serviceId: '../canteen' }, joiningUser), (e) => e.status === 'INVALID_ARGUMENT');
    await call('createNotification', { tokenId: created.id, kind: 'soon' }, joiningUser);
    await call('createNotification', { tokenId: created.id, kind: 'soon' }, joiningUser);
    await assert.rejects(call('createNotification', { tokenId: created.id, kind: 'called' }, users.student), (e) => e.status === 'PERMISSION_DENIED');
    await assertSucceeds(getDoc(doc(db, 'notifications/canteen_2_soon')));
  });

  await t.test('malformed queue counters are rejected before a join can mutate state', async () => {
    await seed();
    const cases = [
      { currentToken: -1, nextToken: 2, waitingNumbers: [1] },
      { currentToken: 0, nextToken: 0, waitingNumbers: [] },
      { currentToken: 1, nextToken: 1, waitingNumbers: [] },
    ];
    for (const counters of cases) {
      await env.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'queues/canteen'), { serviceId: 'canteen', status: 'OPEN', estimatedServiceTime: 2, ...counters });
      });
      await assert.rejects(call('joinQueue', { serviceId: 'canteen' }, users.otherStudent), (error) => error.status === 'FAILED_PRECONDITION');
    }
  });

  await t.test('only the token owner can cancel once; counter, token, lock, and event change together', async () => {
    await seed();
    await assert.rejects(call('cancelQueue', { serviceId: 'canteen', tokenNumber: 1 }, users.otherStudent), (e) => e.status === 'PERMISSION_DENIED');
    // This fixture's lock is present and token is WAITING; direct client lock deletion remains denied.
    const dbStudent = dbFor(users.student);
    await assertFails(deleteDoc(doc(dbStudent, 'activeTokens', `${users.student.uid}_canteen`)));
    await call('cancelQueue', { serviceId: 'canteen', tokenNumber: 1 }, users.student);
    await env.withSecurityRulesDisabled(async (context) => {
      const dbAdmin = context.firestore();
      assert.equal((await getDoc(doc(dbAdmin, 'tokens/canteen_1'))).data().status, 'CANCELLED');
      assert.equal((await getDoc(doc(dbAdmin, 'activeTokens', `${users.student.uid}_canteen`))).exists(), false);
      assert.deepEqual((await getDoc(doc(dbAdmin, 'queues/canteen'))).data().waitingNumbers, []);
      const events = await getDocs(collection(dbAdmin, 'queue_events'));
      assert.ok(events.docs.some((e) => e.data().type === 'CANCELLED' && e.data().actorId === users.student.uid));
    });
    await assert.rejects(call('cancelQueue', { serviceId: 'canteen', tokenNumber: 1 }, users.student), (e) => e.status === 'FAILED_PRECONDITION');
  });

  await t.test('staff can perform queue operations but cannot provision roles or change user documents', async () => {
    await seed();
    const db = dbFor(users.staff);
    await assertSucceeds(getDoc(doc(db, 'tokens/canteen_1')));
    await assertFails(getDoc(doc(db, `users/${users.admin.uid}`)));
    const studentProfiles = await assertSucceeds(getDocs(query(collection(db, 'users'), where('role', '==', 'STUDENT'))));
    assert.ok(studentProfiles.size >= 2);
    await assertFails(getDocs(collection(db, 'queue_events')));
    await assertFails(updateDoc(doc(db, 'queues/canteen'), { status: 'PAUSED' }));
    await assertFails(updateDoc(doc(db, `users/${users.otherStudent.uid}`), { role: 'ADMIN' }));
    await assert.rejects(call('provisionUserRole', { uid: users.otherStudent.uid, role: 'ADMIN' }, users.staff), (e) => e.status === 'PERMISSION_DENIED');
    await assert.rejects(call('provisionUserRole', { uid: 'missing-auth-account', role: 'ADMIN' }, users.staff), (e) => e.status === 'PERMISSION_DENIED');
    await call('callToken', { serviceId: 'canteen', tokenNumber: 1 }, users.staff);
    await call('setTokenStatus', { serviceId: 'canteen', tokenNumber: 1, status: 'SERVING' }, users.staff);
    await call('setTokenStatus', { serviceId: 'canteen', tokenNumber: 1, status: 'COMPLETED' }, users.staff);
    await assert.rejects(call('setTokenStatus', { serviceId: 'canteen', tokenNumber: 1, status: 'SERVING' }, users.staff), (e) => e.status === 'FAILED_PRECONDITION');
    await assert.rejects(call('saveService', { id: 'new', name: 'New', icon: 'N', description: '', estimatedServiceTime: 1, active: true }, users.staff), (e) => e.status === 'PERMISSION_DENIED');
    await assertFails(updateDoc(doc(db, `users/${users.staff.uid}`), { role: 'ADMIN' }));
    await env.withSecurityRulesDisabled(async (context) => {
      const dbAdmin = context.firestore();
      assert.equal((await getDoc(doc(dbAdmin, 'tokens/canteen_1'))).data().status, 'COMPLETED');
      assert.equal((await getDoc(doc(dbAdmin, 'activeTokens', `${users.student.uid}_canteen`))).exists(), false);
      const events = await getDocs(collection(dbAdmin, 'queue_events'));
      assert.ok(events.docs.some((e) => e.data().type === 'CALLED' && e.data().actorId === users.staff.uid));
    });
  });

  await t.test('only administrators can manage services, settings, and role provisioning', async () => {
    await seed();
    const studentDb = dbFor(users.student);
    await assertFails(setDoc(doc(studentDb, 'notifications/fake'), { userId: users.student.uid, title: 'Forged', body: 'Forged', type: 'called', read: false }));
    await assertFails(updateDoc(doc(studentDb, 'notifications/private_note'), { read: false }));
    await assertSucceeds(updateDoc(doc(studentDb, 'notifications/private_note'), { read: true }));
    await assert.rejects(call('provisionUserRole', { uid: users.otherStudent.uid, role: 'STAFF' }, users.student), (e) => e.status === 'PERMISSION_DENIED');
    await assert.rejects(call('provisionUserRole', { uid: 'missing-auth-account', role: 'STAFF' }, users.student), (e) => e.status === 'PERMISSION_DENIED');
    await assert.rejects(call('saveSettings', { lowMax: 2, moderateMax: 4 }, users.staff), (e) => e.status === 'PERMISSION_DENIED');
    await assert.rejects(call('provisionUserRole', { uid: users.otherStudent.uid, role: 'STAFF' }, users.staff), (e) => e.status === 'PERMISSION_DENIED');
    await assert.rejects(call('provisionUserRole', { uid: 'missing-auth-account', role: 'STAFF' }, users.staff), (e) => e.status === 'PERMISSION_DENIED');
    await call('provisionUserRole', { uid: users.otherStudent.uid, role: 'STAFF' }, users.admin);
    await call('saveService', { id: 'library', name: 'Library', icon: '📚', description: 'Books', estimatedServiceTime: 3, active: true }, users.admin);
    await call('saveSettings', { lowMax: 4, moderateMax: 12 }, users.admin);
    await assert.rejects(call('saveSettings', { lowMax: 12, moderateMax: 4 }, users.admin), (e) => e.status === 'INVALID_ARGUMENT');
    await assert.rejects(call('seedDemoData', {}, users.staff), (e) => e.status === 'PERMISSION_DENIED');
    await env.withSecurityRulesDisabled(async (context) => {
      const dbAdmin = context.firestore();
      assert.equal((await getDoc(doc(dbAdmin, `users/${users.otherStudent.uid}`))).data().role, 'STAFF');
      assert.equal((await getDoc(doc(dbAdmin, 'settings/crowd'))).data().lowMax, 4);
      assert.equal((await getDoc(doc(dbAdmin, 'queues/library'))).exists(), true);
    });
  });

  await t.test('demo seeding is admin-only, creates matching locks, and refuses live data', async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${users.admin.uid}`), { name: 'admin', role: 'ADMIN', email: users.admin.email });
    });
    await call('seedDemoData', {}, users.admin);
    await call('seedDemoData', {}, users.admin);
    await env.withSecurityRulesDisabled(async (context) => {
      const dbAdmin = context.firestore();
      const queue = await getDoc(doc(dbAdmin, 'queues/canteen'));
      const lock = await getDoc(doc(dbAdmin, 'activeTokens/demo-user-0_canteen'));
      assert.equal(queue.data().nextToken, 12);
      assert.equal(lock.data().tokenId, 'canteen_10');
      await setDoc(doc(dbAdmin, 'tokens/live-token'), { userId: users.student.uid, serviceId: 'canteen', tokenNumber: 999, status: 'WAITING' });
    });
    await assert.rejects(call('seedDemoData', {}, users.admin), (e) => e.status === 'FAILED_PRECONDITION');
  });
});
