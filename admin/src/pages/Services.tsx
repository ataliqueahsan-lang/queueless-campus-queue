import { useState, type FormEvent } from 'react';
import { PageHeader, QueueStatusBadge } from '../components/Common';
import { useData } from '../context/DataContext';
import { repo } from '../services/repo';
import type { Service } from '../types';

const blank = { id: '', name: '', icon: '🏥', description: '', estimatedServiceTime: 3, active: true };

export default function Services() {
  const { services, queues, run, setToast } = useData();
  const [form, setForm] = useState<typeof blank & { order?: number }>(blank);
  const [editing, setEditing] = useState(false);

  const edit = (s: Service) => { setForm(s); setEditing(true); };
  function submit(e: FormEvent) {
    e.preventDefault();
    const id = (editing ? form.id : form.name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!id || !form.name.trim()) return setToast('⚠️ Please enter a service name.');
    run(async () => { await repo.saveService({ ...form, id, name: form.name.trim() }); setForm(blank); setEditing(false); },
      editing ? 'Service updated' : 'Service added. It now appears in the student app.');
  }
  return (
    <>
      <PageHeader title="Services" subtitle="Add a new campus service here and it shows up in the student app automatically." />
      <div className="grid2 wide-left">
        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th></th><th>Service</th><th>Avg time</th><th>Queue</th><th></th></tr></thead>
            <tbody>
              {services.map((s) => {
                const q = queues.find((x) => x.serviceId === s.id);
                return (
                  <tr key={s.id}>
                    <td style={{ fontSize: 22 }}>{s.icon}</td>
                    <td><b>{s.name}</b><div className="muted small">{s.description}</div></td>
                    <td>{s.estimatedServiceTime} min</td>
                    <td>{q ? <QueueStatusBadge status={q.status} /> : '—'}</td>
                    <td><button className="btn sm ghost" onClick={() => edit(s)}>Edit</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <form className="card form" onSubmit={submit}>
          <h3>{editing ? `Edit ${form.name}` : 'Add a service'}</h3>
          <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sports Complex" /></label>
          <label>Icon (emoji)<input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} maxLength={4} /></label>
          <label>Description<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label>Average service time (minutes)<input type="number" min={1} max={60} value={form.estimatedServiceTime} onChange={(e) => setForm({ ...form, estimatedServiceTime: Math.max(1, Number(e.target.value)) })} /></label>
          <label className="check"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Visible to students</label>
          <div className="row-actions">
            <button className="btn primary">{editing ? 'Save changes' : 'Add service'}</button>
            {editing && <button type="button" className="btn ghost" onClick={() => { setForm(blank); setEditing(false); }}>Cancel</button>}
          </div>
        </form>
      </div>
    </>
  );
}
