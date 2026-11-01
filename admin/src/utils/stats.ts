import type { Queue, Service, Token } from '../types';

export interface Stats {
  activeQueues: number; waiting: number; served: number; avgWaitMin: number;
  usage: { label: string; value: number }[];
  hourly: { label: string; value: number }[];
  peakLabel: string;
}

export function computeStats(tokens: Token[], queues: Queue[], services: Service[]): Stats {
  const served = tokens.filter((t) => t.status === 'COMPLETED');
  const waits = tokens.filter((t) => t.calledAt).map((t) => (t.calledAt! - t.createdAt) / 60000);
  const avgWaitMin = waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : 0;
  const usage = services.map((s) => ({ label: s.name, value: tokens.filter((t) => t.serviceId === s.id).length }));
  const perHour = new Array(24).fill(0) as number[];
  tokens.forEach((t) => { perHour[new Date(t.createdAt).getHours()]++; });
  const first = Math.max(0, perHour.findIndex((v) => v > 0) - 1);
  const lastIdx = perHour.map((v, i) => (v > 0 ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
  const last = Math.min(23, lastIdx + 1);
  const hourly = perHour.slice(first, Math.max(last, first) + 1).map((v, i) => ({
    label: `${(first + i) % 12 || 12}${first + i >= 12 ? 'p' : 'a'}`, value: v,
  }));
  const max = Math.max(...perHour);
  const peakHour = max > 0 ? perHour.indexOf(max) : -1;
  const fmt = (h: number) => `${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`;
  return {
    activeQueues: queues.filter((q) => q.status !== 'CLOSED').length,
    waiting: queues.reduce((a, q) => a + q.waitingNumbers.length, 0),
    served: served.length, avgWaitMin, usage, hourly,
    peakLabel: peakHour < 0 ? 'No data yet' : `${fmt(peakHour)} – ${fmt((peakHour + 1) % 24)}`,
  };
}
