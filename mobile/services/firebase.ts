import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
// @ts-ignore - getReactNativePersistence is exported by the React Native build of firebase/auth
import { getReactNativePersistence } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const cfg = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};
export const isFirebaseConfigured = Boolean(cfg.apiKey && cfg.projectId);
/** Demo mode = no Firebase needed. Forced on by env var, or automatic when keys are missing. */
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === 'true' || !isFirebaseConfigured;

let cache: { auth: Auth; db: Firestore } | null = null;
export function fb() {
  if (cache) return cache;
  const app = getApps().length ? getApp() : initializeApp(cfg);
  let auth: Auth;
  try { auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) }); }
  catch { auth = getAuth(app); }
  cache = { auth, db: getFirestore(app) };
  return cache;
}
