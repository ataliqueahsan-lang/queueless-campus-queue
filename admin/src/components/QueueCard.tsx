import { useData } from '../context/DataContext';
import { repo } from '../services/repo';
import type { Queue, Service } from '../types';
import { estimateWait } from '../utils/queueLogic';
import { CrowdBadge, QueueStatusBadge } from './Common';

export function QueueCard({ service, queue, onOpen }: { service: Service; queue: Queue; onOpen?: () => void }) {
  const { run, crowd, user } = useData();
  const waiting = queue.waitingNumbers.length;
  const paused = queue.status !== 'OPEN';
  return (
    <div className="card queue-card">
      <div className="qc-head" onClick={onOpen} style={{ cursor: onOpen ? 'pointer' : 'default' }}>
        <div className="qc-icon">{service.icon}</div>
        <div style={{ flex: 1 }}>
          <div className="qc-name">{service.name}</div>
          <div className="qc-badges"><QueueStatusBadge status={queue.status} /><CrowdBadge queue={queue} crowd={crowd} /></div>
        </div>
      </div>
      <div className="qc-grid">
        <div><span className="muted">Currently serving</span><b className="big">{queue.currentToken > 0 ? `#${queue.currentToken}` : '—'}</b></div>
        <div><span className="muted">Waiting</span><b className="big">{waiting}</b></div>
        <div><span className="muted">Est. wait (last)</span><b className="big">~{estimateWait(waiting, queue.estimatedServiceTime)}m</b></div>
      </div>
      <div className="qc-actions">
        <button className="btn primary" disabled={waiting === 0 || paused}
          onClick={() => run(() => repo.callToken(service.id, null, user!), `Called next token in ${service.name}`)}>
          CALL NEXT
        </button>
        <button className="btn ghost"
          onClick={() => run(() => repo.setQueueStatus(service.id, paused ? 'OPEN' : 'PAUSED'), paused ? `${service.name} resumed` : `${service.name} paused`)}>
          {paused ? 'RESUME QUEUE' : 'PAUSE QUEUE'}
        </button>
      </div>
    </div>
  );
}
