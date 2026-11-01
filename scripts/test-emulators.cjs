const { spawnSync } = require('node:child_process');

const firebaseCli = require.resolve('firebase-tools/lib/bin/firebase.js');
const result = spawnSync(process.execPath, [
  firebaseCli,
  'emulators:exec',
  '--project', 'demo-queueless',
  '--only', 'auth,firestore,functions',
  'node --test tests/security.emulator.test.cjs',
], {
  stdio: 'inherit',
  env: { ...process.env, FUNCTIONS_DISCOVERY_TIMEOUT: '90000', QUEUELESS_ALLOW_DEMO_SEED: 'true' },
});

if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
