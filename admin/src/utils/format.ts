export const pad = (n: number) => String(n).padStart(2, '0');
export function formatTime(ms: number | null): string {
  if (!ms) return '—';
  const d = new Date(ms);
  const h = d.getHours() % 12 || 12;
  return `${h}:${pad(d.getMinutes())} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
}
export const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const CROWD_LABEL = { LOW: '🟢 Low', MODERATE: '🟡 Moderate', HIGH: '🔴 High' } as const;

const MESSAGES: Record<string, string> = {
  PAUSED: 'This queue is paused. Resume it first.',
  CLOSED: 'This queue is closed.',
  EMPTY: 'Nobody is waiting in this queue.',
  NOT_FOUND: 'That queue or token could not be found.',
  NOT_WAITING: 'That token is no longer waiting.',
  BAD_TRANSITION: 'That action is not allowed for the token’s current state.',
  NOT_STAFF: 'This account does not have staff access.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'No internet connection. Please check your network.',
  'permission-denied': 'You do not have permission to do that.',
  unavailable: 'Firebase is unreachable right now. Please try again.',
};
export function friendlyError(e: unknown): string {
  const err = e as { code?: string; message?: string };
  const key = (err?.code ?? '').replace('firestore/', '');
  return MESSAGES[key] ?? MESSAGES[err?.message ?? ''] ?? 'Something went wrong. Please try again.';
}
