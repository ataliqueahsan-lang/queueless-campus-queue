import type { ReactNode } from 'react';
import { crowdLevel } from '../utils/queueLogic';
import type { CrowdSettings, Queue, QueueStatus, TokenStatus } from '../types';
import { CROWD_LABEL } from '../utils/format';

export function StatCard({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: string; accent?: string }) {
  return (
    <div className="card stat" style={accent ? { borderTop: `4px solid ${accent}` } : undefined}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

export function CrowdBadge({ queue, crowd }: { queue: Queue; crowd: CrowdSettings }) {
  const level = crowdLevel(queue.waitingNumbers.length, crowd);
  return <span className={`badge crowd-${level.toLowerCase()}`}>{CROWD_LABEL[level]}</span>;
}

export function QueueStatusBadge({ status }: { status: QueueStatus }) {
  return <span className={`badge qs-${status.toLowerCase()}`}>{status === 'OPEN' ? 'Open' : status === 'PAUSED' ? 'Paused' : 'Closed'}</span>;
}

export function TokenBadge({ status }: { status: TokenStatus }) {
  return <span className={`badge ts-${status.toLowerCase()}`}>{status.charAt(0) + status.slice(1).toLowerCase()}</span>;
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="page-header">
      <div><h1>{title}</h1>{subtitle && <p className="muted">{subtitle}</p>}</div>
      {right}
    </div>
  );
}

export function BarChart({ data, color = '#2F4BFF', emptyText = 'No data yet' }: { data: { label: string; value: number }[]; color?: string; emptyText?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length || data.every((d) => d.value === 0)) return <p className="muted">{emptyText}</p>;
  return (
    <div className="bars">
      {data.map((d) => (
        <div className="bar-col" key={d.label}>
          <div className="bar-value">{d.value}</div>
          <div className="bar" style={{ height: `${(d.value / max) * 100}%`, background: color }} />
          <div className="bar-label">{d.label}</div>
        </div>
      ))}
    </div>
  );
}
