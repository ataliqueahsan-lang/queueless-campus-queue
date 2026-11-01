const { applicationDefault, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

async function main() {
  const [projectId, uid] = process.argv.slice(2);
  if (!projectId || !uid) {
    throw new Error('Usage: npm run bootstrap-admin -- <firebase-project-id> <existing-auth-uid>');
  }
  initializeApp({ credential: applicationDefault(), projectId });
  const auth = getAuth();
  const user = await auth.getUser(uid);
  if (user.disabled) throw new Error('The target account is disabled.');
  const profile = getFirestore().doc(`users/${uid}`);
  const snapshot = await profile.get();
  if (!snapshot.exists) throw new Error('Create the account and student profile before bootstrapping the first admin.');
  await profile.update({ role: 'ADMIN' });
  process.stdout.write('Initial administrator role provisioned.\n');
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
