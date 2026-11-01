import { QueueError } from './queueLogic';

const FIREBASE: Record<string, string> = {
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/user-not-found': 'No account found with that email.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/email-already-in-use': 'An account with this email already exists. Try logging in.',
  'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'No internet connection. Please check your network.',
  unavailable: 'We can’t reach the server right now. Please check your connection.',
  'permission-denied': 'You don’t have permission to do that.',
};
const QUEUE: Record<string, string> = {
  CLOSED: 'This service is closed right now.',
  PAUSED: 'This queue is paused. Please check back in a few minutes.',
  DUPLICATE: 'You already have an active token for this service.',
  NOT_FOUND: 'We couldn’t find that queue.',
  EMPTY: 'The queue is empty.',
  NOT_WAITING: 'That token is no longer waiting.',
  BAD_TRANSITION: 'That action isn’t available right now.',
};

export function friendlyError(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (e instanceof QueueError) return QUEUE[e.code] ?? fallback;
  const code = ((e as { code?: string })?.code ?? '').replace('firestore/', '');
  return FIREBASE[code] ?? fallback;
}
export const JOIN_FAILED = 'Unable to join the queue right now. Please try again.';
