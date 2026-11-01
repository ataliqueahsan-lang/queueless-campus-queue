import { Vibration } from 'react-native';
import { emitAlert } from './alerts';
import { getPrefs } from './prefs';
import { repo } from './repo';

/**
 * Notification service abstraction.
 * InAppNotifier (default) stores the alert in Firestore/notification centre and shows an in-app banner.
 * To add real push later: create a PushNotifier implementing `Notifier` (register an Expo/FCM token per
 * user, send from a Cloud Function when a token changes) and export it here instead. No screen changes needed.
 */
export interface Notifier { send(uid: string, id: string, n: { title: string; body: string; type: string }): Promise<void> }

export const inAppNotifier: Notifier = {
  async send(uid, id, n) {
    try { await repo.pushNotification(uid, id, n); } catch { /* already stored or offline: banner still shows */ }
    if (getPrefs().banners) emitAlert({ id, title: n.title, body: n.body });
    if (getPrefs().vibrate) Vibration.vibrate(n.type === 'called' ? [0, 250, 120, 250] : 120);
  },
};
export const notifier: Notifier = inAppNotifier;

export function messageFor(kind: string, tokenNumber: number): { title: string; body: string } | null {
  switch (kind) {
    case 'joined': return { title: 'You’re in the queue', body: 'You’re in the queue. We’ll notify you when your turn gets closer.' };
    case 'soon': return { title: 'Your turn is coming!', body: 'Your turn is coming! Please get ready.' };
    case 'next': return { title: 'You’re next!', body: 'You’re next! Please go to the counter.' };
    case 'called': return { title: 'It’s your turn', body: `Your token #${tokenNumber} is now being served. Please go to the counter.` };
    case 'completed': return { title: 'Token completed', body: 'Your QueueLess token has been completed. Thank you!' };
    case 'skipped': return { title: 'Token skipped', body: `Your token #${tokenNumber} was skipped. You can join the queue again any time.` };
    default: return null;
  }
}
