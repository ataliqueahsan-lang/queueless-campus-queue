// Pure queue logic. Used by BOTH the Firestore transactions and the demo (mock) store,
// so the algorithm is written once and behaves identically in both modes.
import type { CrowdLevel, CrowdSettings, Queue, TokenStatus } from '../types';

export type QueueErrorCode =
  | 'CLOSED' | 'PAUSED' | 'EMPTY' | 'DUPLICATE' | 'NOT_FOUND' | 'NOT_WAITING' | 'BAD_TRANSITION';

export class QueueError extends Error {
  code: QueueErrorCode;
  constructor(code: QueueErrorCode) { super(code); this.code = code; this.name = 'QueueError'; }
}

export const ACTIVE_STATUSES: TokenStatus[] = ['WAITING', 'CALLED', 'SERVING'];
export const isActive = (s: TokenStatus) => ACTIVE_STATUSES.includes(s);

const TRANSITIONS: Record<TokenStatus, TokenStatus[]> = {
  WAITING: ['CALLED', 'SKIPPED', 'CANCELLED'],
  CALLED: ['SERVING', 'COMPLETED', 'SKIPPED', 'CANCELLED'],
  SERVING: ['COMPLETED'],
  COMPLETED: [], SKIPPED: [], CANCELLED: [],
};
export const canTransition = (from: TokenStatus, to: TokenStatus) => TRANSITIONS[from].includes(to);

/** position = number of WAITING tokens ahead of me + 1 */
export const positionOf = (q: Pick<Queue, 'waitingNumbers'>, tokenNumber: number) =>
  q.waitingNumbers.filter((n) => n < tokenNumber).length + 1;

/** Estimate only: position x average service time (minutes). */
export const estimateWait = (position: number, avgMinutes: number) => Math.max(0, position * avgMinutes);

export function crowdLevel(queueLength: number, t: CrowdSettings): CrowdLevel {
  if (queueLength <= t.lowMax) return 'LOW';
  if (queueLength <= t.moderateMax) return 'MODERATE';
  return 'HIGH';
}

export function applyJoin(q: Queue): { queue: Queue; tokenNumber: number } {
  if (q.status === 'CLOSED') throw new QueueError('CLOSED');
  if (q.status === 'PAUSED') throw new QueueError('PAUSED');
  const tokenNumber = q.nextToken;
  return { queue: { ...q, nextToken: tokenNumber + 1, waitingNumbers: [...q.waitingNumbers, tokenNumber] }, tokenNumber };
}

/** Call the next waiting token, or a specific waiting token (admin table "Call"). */
export function applyCall(q: Queue, specific?: number): { queue: Queue; target: number } {
  if (q.status === 'PAUSED') throw new QueueError('PAUSED');
  if (q.status === 'CLOSED') throw new QueueError('CLOSED');
  if (q.waitingNumbers.length === 0) throw new QueueError('EMPTY');
  const target = specific ?? Math.min(...q.waitingNumbers);
  if (!q.waitingNumbers.includes(target)) throw new QueueError('NOT_WAITING');
  return { queue: { ...q, currentToken: target, waitingNumbers: q.waitingNumbers.filter((n) => n !== target) }, target };
}

export function applyRemove(q: Queue, tokenNumber: number): Queue {
  return { ...q, waitingNumbers: q.waitingNumbers.filter((n) => n !== tokenNumber) };
}

export const tokenDocId = (serviceId: string, n: number) => `${serviceId}_${n}`;
export const lockDocId = (uid: string, serviceId: string) => `${uid}_${serviceId}`;
