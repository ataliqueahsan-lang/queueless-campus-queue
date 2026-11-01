import { HttpsError } from 'firebase-functions/v2/https';

type DemoSeedEnvironment = {
  FUNCTIONS_EMULATOR?: string;
  QUEUELESS_ALLOW_DEMO_SEED?: string;
};

export function assertDemoSeedingAllowed(environment: DemoSeedEnvironment): void {
  if (environment.FUNCTIONS_EMULATOR !== 'true' || environment.QUEUELESS_ALLOW_DEMO_SEED !== 'true') {
    throw new HttpsError('permission-denied', 'Demo seeding is available only in an explicitly enabled Firebase Emulator.');
  }
}
