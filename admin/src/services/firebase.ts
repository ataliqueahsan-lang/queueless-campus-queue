import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const env = import.meta.env;
const cfg = {
  apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID, storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID, appId: env.VITE_FIREBASE_APP_ID,
};
export const isFirebaseConfigured = Boolean(cfg.apiKey && cfg.projectId);
export const DEMO_MODE = env.VITE_DEMO_MODE === 'true' || !isFirebaseConfigured;

let cache: { auth: ReturnType<typeof getAuth>; db: ReturnType<typeof getFirestore> } | null = null;
export function fb() {
  if (!cache) { const app = initializeApp(cfg); cache = { auth: getAuth(app), db: getFirestore(app) }; }
  return cache;
}
