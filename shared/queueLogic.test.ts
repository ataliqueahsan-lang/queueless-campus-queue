import { applyJoin, applyCall, applyRemove, positionOf, estimateWait, crowdLevel, canTransition, QueueError } from './queueLogic';
import { DEFAULT_CROWD, Queue } from './types';
const assert = (c: boolean, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } else console.log('ok  ', m); };
let q: Queue = { serviceId: 'canteen', currentToken: 9, nextToken: 12, status: 'OPEN', estimatedServiceTime: 2, waitingNumbers: [10, 11] };
const j = applyJoin(q); q = j.queue;
assert(j.tokenNumber === 12, 'student gets #12');
assert(positionOf(q, 12) === 3, 'position 3');
assert(estimateWait(3, 3) === 9, 'wait 9 min');
let c = applyCall(q); q = c.queue; assert(c.target === 10 && q.currentToken === 10 && positionOf(q, 12) === 2, 'call #10 -> position 2');
c = applyCall(q); q = c.queue; assert(c.target === 11 && positionOf(q, 12) === 1, 'call #11 -> position 1');
c = applyCall(q); q = c.queue; assert(c.target === 12 && q.waitingNumbers.length === 0, 'call #12 -> called');
try { applyCall(q); assert(false, 'empty should throw'); } catch (e) { assert((e as QueueError).code === 'EMPTY', 'empty queue error'); }
try { applyJoin({ ...q, status: 'PAUSED' }); assert(false, 'paused'); } catch (e) { assert((e as QueueError).code === 'PAUSED', 'paused blocks join'); }
// unique numbers under 50 sequential joins
let z: Queue = { ...q, waitingNumbers: [], nextToken: 100 }; const seen = new Set<number>();
for (let i = 0; i < 50; i++) { const r = applyJoin(z); z = r.queue; seen.add(r.tokenNumber); }
assert(seen.size === 50, '50 unique tokens');
assert(crowdLevel(5, DEFAULT_CROWD) === 'LOW' && crowdLevel(6, DEFAULT_CROWD) === 'MODERATE' && crowdLevel(15, DEFAULT_CROWD) === 'MODERATE' && crowdLevel(16, DEFAULT_CROWD) === 'HIGH', 'crowd thresholds 0-5/6-15/16+');
assert(canTransition('WAITING', 'CALLED') && !canTransition('COMPLETED', 'WAITING') && !canTransition('SERVING', 'SKIPPED'), 'state transitions');
assert(applyRemove({ ...q, waitingNumbers: [1, 2, 3] }, 2).waitingNumbers.join() === '1,3', 'leave removes number');
