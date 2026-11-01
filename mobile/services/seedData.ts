import type { Queue, Service, Token } from '../types';
import { tokenDocId } from '../utils/queueLogic';

export const SEED_SERVICES: Service[] = [
  { id: 'canteen', name: 'Canteen', icon: '🍔', description: 'Meals, snacks and beverages', estimatedServiceTime: 2, order: 1, active: true },
  { id: 'library', name: 'Library', icon: '📚', description: 'Book issue, returns and desk help', estimatedServiceTime: 3, order: 2, active: true },
  { id: 'office', name: 'Office', icon: '🏢', description: 'Admissions, fees and certificates', estimatedServiceTime: 5, order: 3, active: true },
  { id: 'laboratory', name: 'Laboratory', icon: '🧪', description: 'Lab slots and equipment issue', estimatedServiceTime: 4, order: 4, active: true },
];

// canteen starts at #9 serving with #10 and #11 waiting, so the next student gets #12 at position 3
export const SEED_QUEUES: Queue[] = [
  { serviceId: 'canteen', currentToken: 9, nextToken: 12, status: 'OPEN', estimatedServiceTime: 2, waitingNumbers: [10, 11] },
  { serviceId: 'library', currentToken: 24, nextToken: 30, status: 'OPEN', estimatedServiceTime: 3, waitingNumbers: [25, 26, 27, 28, 29] },
  { serviceId: 'office', currentToken: 4, nextToken: 8, status: 'PAUSED', estimatedServiceTime: 5, waitingNumbers: [5, 6, 7] },
  { serviceId: 'laboratory', currentToken: 30, nextToken: 47, status: 'OPEN', estimatedServiceTime: 4, waitingNumbers: Array.from({ length: 16 }, (_, i) => 31 + i) },
];

const NAMES = ['Rahul', 'Ahsan', 'Priya', 'Neha', 'Arjun', 'Sana', 'Vikram', 'Meera', 'Kabir', 'Isha', 'Dev', 'Anaya', 'Rohan', 'Zoya', 'Kiran', 'Tara'];

/** Sample waiting tokens for every seeded queue + some tokens served earlier today (for analytics). */
export function buildSeedTokens(services: Service[], queues: Queue[]): Token[] {
  const now = Date.now(); const out: Token[] = []; let ni = 0;
  const nameOf = (id: string) => services.find((s) => s.id === id)?.name ?? id;
  queues.forEach((q) => {
    q.waitingNumbers.forEach((n, i) => {
      out.push({
        id: tokenDocId(q.serviceId, n), tokenNumber: n, serviceId: q.serviceId, serviceName: nameOf(q.serviceId),
        userId: `demo-user-${ni}`, userName: NAMES[ni++ % NAMES.length], status: 'WAITING', positionAtJoin: i + 1,
        createdAt: now - (q.waitingNumbers.length - i) * 120000, calledAt: null, completedAt: null,
      });
    });
    for (let k = 0; k < 6; k++) { // completed earlier today
      const created = now - (2 + k) * 45 * 60000; const called = created + (3 + k) * 60000;
      const n = q.currentToken - 1 - k; if (n <= 0) continue;
      out.push({
        id: tokenDocId(q.serviceId, n), tokenNumber: n, serviceId: q.serviceId, serviceName: nameOf(q.serviceId),
        userId: `demo-user-${ni}`, userName: NAMES[ni++ % NAMES.length], status: 'COMPLETED', positionAtJoin: 3,
        createdAt: created, calledAt: called, completedAt: called + q.estimatedServiceTime * 60000,
      });
    }
  });
  return out;
}
