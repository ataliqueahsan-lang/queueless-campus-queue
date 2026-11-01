import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

interface Prefs { banners: boolean; vibrate: boolean }
let prefs: Prefs = { banners: true, vibrate: true };
const listeners = new Set<() => void>();
AsyncStorage.getItem('queueless_prefs').then((v) => { if (v) { prefs = { ...prefs, ...JSON.parse(v) }; listeners.forEach((f) => f()); } }).catch(() => {});

export const getPrefs = () => prefs;
export function usePrefs() {
  const [p, setP] = useState(prefs);
  useEffect(() => { const f = () => setP({ ...prefs }); listeners.add(f); f(); return () => { listeners.delete(f); }; }, []);
  const set = (patch: Partial<Prefs>) => {
    prefs = { ...prefs, ...patch };
    AsyncStorage.setItem('queueless_prefs', JSON.stringify(prefs)).catch(() => {});
    listeners.forEach((f) => f());
  };
  return { prefs: p, set };
}
