import { useSearchParams } from 'react-router-dom';
import { PageHeader, TokenBadge } from '../components/Common';
import { QueueCard } from '../components/QueueCard';
import { useData } from '../context/DataContext';
import { repo } from '../services/repo';
import type { Token } from '../types';
import { formatTime } from '../utils/format';

export default function Queues() {
  const { services, queues, tokens, run, user } = useData();
  const [params, setParams] = useSearchParams();
  const selected = params.get('service') ?? services[0]?.id;
  const service = services.find((s) => s.id === selected);
  const queue = queues.find((q) => q.serviceId === selected);
  const rows = tokens.filter((t) => t.serviceId === selected).sort((a, b) => b.tokenNumber - a.tokenNumber);
  const order = { CALLED: 0, SERVING: 1, WAITING: 2, COMPLETED: 3, SKIPPED: 4, CANCELLED: 5 } as const;
  rows.sort((a, b) => order[a.status] - order[b.status] || (a.status === 'WAITING' ? a.tokenNumber - b.tokenNumber : b.tokenNumber - a.tokenNumber));

  const act = (t: Token, fn: () => Promise<void>, msg: string) => run(fn, msg);
  const actions = (t: Token) => (
    <div className="row-actions">
      {t.status === 'WAITING' && <button className="btn sm primary" disabled={queue?.status !== 'OPEN'} onClick={() => act(t, () => repo.callToken(t.serviceId, t.tokenNumber, user!), `Called #${t.tokenNumber}`)}>Call</button>}
      {t.status === 'CALLED' && <button className="btn sm" onClick={() => act(t, () => repo.setTokenStatus(t, 'SERVING', user!), `#${t.tokenNumber} is being served`)}>Serve</button>}
      {(t.status === 'CALLED' || t.status === 'SERVING') && <button className="btn sm success" onClick={() => act(t, () => repo.setTokenStatus(t, 'COMPLETED', user!), `#${t.tokenNumber} completed`)}>Complete</button>}
      {(t.status === 'WAITING' || t.status === 'CALLED') && <button className="btn sm ghost" onClick={() => act(t, () => repo.setTokenStatus(t, 'SKIPPED', user!), `#${t.tokenNumber} skipped`)}>Skip</button>}
    </div>
  );

  return (
    <>
      <PageHeader title="Queues" subtitle="Manage tokens for a service." />
      <div className="tabs">
        {services.map((s) => (
          <button key={s.id} className={'tab' + (s.id === selected ? ' active' : '')} onClick={() => setParams({ service: s.id })}>{s.icon} {s.name}</button>
        ))}
      </div>
      {service && queue && <QueueCard service={service} queue={queue} />}
      <div className="card" style={{ marginTop: 20, overflowX: 'auto' }}>
        <h3>Tokens today · {service?.name}</h3>
        {rows.length === 0 ? <p className="muted">No tokens yet. When a student joins this queue they will appear here instantly.</p> : (
          <table>
            <thead><tr><th>Token</th><th>Student</th><th>Service</th><th>Status</th><th>Time</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td><b>#{t.tokenNumber}</b></td><td>{t.userName}</td><td>{t.serviceName}</td>
                  <td><TokenBadge status={t.status} /></td><td>{formatTime(t.createdAt)}</td><td>{actions(t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
