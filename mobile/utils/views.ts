import type { CrowdLevel, CrowdSettings, Queue, Service } from '@/types';
import { crowdLevel, estimateWait } from './queueLogic';

export type DisplayStatus = 'OPEN' | 'BUSY' | 'PAUSED' | 'CLOSED';
export interface ServiceView {
  service: Service; queue: Queue | null; waiting: number; estWait: number; crowd: CrowdLevel; status: DisplayStatus;
}

export function buildViews(services: Service[], queues: Queue[], crowd: CrowdSettings): ServiceView[] {
  return services.filter((s) => s.active !== false).map((service) => {
    const queue = queues.find((q) => q.serviceId === service.id) ?? null;
    const waiting = queue?.waitingNumbers.length ?? 0;
    const level = crowdLevel(waiting, crowd);
    const status: DisplayStatus = !queue || queue.status === 'CLOSED' ? 'CLOSED' : queue.status === 'PAUSED' ? 'PAUSED' : level === 'HIGH' ? 'BUSY' : 'OPEN';
    return { service, queue, waiting, estWait: estimateWait(waiting + 1, queue?.estimatedServiceTime ?? service.estimatedServiceTime), crowd: level, status };
  });
}
export const CROWD_EMOJI: Record<CrowdLevel, string> = { LOW: '🟢', MODERATE: '🟡', HIGH: '🔴' };
export const CROWD_TEXT: Record<CrowdLevel, string> = { LOW: 'Low', MODERATE: 'Moderate', HIGH: 'High' };
