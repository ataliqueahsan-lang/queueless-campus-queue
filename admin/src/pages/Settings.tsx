import { useEffect, useState } from 'react';
import { PageHeader } from '../components/Common';
import { useData } from '../context/DataContext';
import { repo } from '../services/repo';

const IMPLEMENTED = [
  'Real-time queues with Firestore listeners', 'Race-free token numbers (Firestore transactions)',
  'One active token per student per service', 'Staff controls: call next, skip, complete, pause/resume',
  'Position and wait estimate from live data', 'In-app notifications', 'Crowd levels with configurable thresholds',
  'Basic analytics', 'Role-based Firestore security rules', 'Demo mode with sample data',
];
const FUTURE = [
  ['AI-based queue prediction', 'Forecast wait times from historical patterns.'],
  ['Live campus crowd heatmap', 'Visualise crowding across the whole campus.'],
  ['University ID integration', 'Sign in with the official student ID / SSO.'],
  ['Multi-campus support', 'Manage several campuses from one console.'],
  ['Smarter service planning', 'Use history to suggest staffing and counter timings.'],
];

export default function Settings() {
  const { crowd, run, user } = useData();
  const [low, setLow] = useState(crowd.lowMax);
  const [mod, setMod] = useState(crowd.moderateMax);
  useEffect(() => { setLow(crowd.lowMax); setMod(crowd.moderateMax); }, [crowd.lowMax, crowd.moderateMax]);
  const valid = low >= 0 && mod > low;

  return (
    <>
      <PageHeader title="Settings" subtitle="Crowd thresholds, demo data and project roadmap." />
      <div className="grid2">
        <div className="card form">
          <h3>Crowd thresholds</h3>
          <p className="muted small">Queue length up to <b>Low</b> is 🟢, up to <b>Moderate</b> is 🟡, anything above is 🔴.</p>
          <label>Low: up to (people)<input type="number" min={0} value={low} onChange={(e) => setLow(Number(e.target.value))} /></label>
          <label>Moderate: up to (people)<input type="number" min={1} value={mod} onChange={(e) => setMod(Number(e.target.value))} /></label>
          {!valid && <div className="banner error">Moderate must be greater than Low.</div>}
          {user?.role === 'ADMIN' ? <button className="btn primary" disabled={!valid} onClick={() => run(() => repo.saveSettings({ lowMax: low, moderateMax: mod }), 'Thresholds saved. The student app updates instantly.')}>Save thresholds</button> : <p className="muted small">Only administrators can change crowd thresholds.</p>}
        </div>
        <div className="card form">
          <h3>Demo data</h3>
          <p className="muted small">Creates the four sample services with sample queues and sample tokens. Use it before a presentation, or to reset the demo.
            {repo.mode === 'demo' ? ' (Demo mode: resets the in-memory data.)' : ' This overwrites the sample services and queues in your Firebase project.'}</p>
          {user?.role === 'ADMIN' && <button className="btn primary" onClick={() => { if (confirm('Load / reset the sample data?')) run(() => repo.seedDemoData(), 'Demo data loaded'); }}>Load demo data</button>}
          <p className="muted small">Mode: <b>{repo.mode === 'demo' ? 'Demo (no Firebase)' : 'Firebase (live)'}</b></p>
        </div>
      </div>
      <div className="grid2" style={{ marginTop: 20 }}>
        <div className="card">
          <h3>✅ Implemented in this prototype</h3>
          <ul className="ticks">{IMPLEMENTED.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
        <div className="card">
          <h3>🔭 Future scope <span className="badge qs-paused">Not implemented</span></h3>
          <ul className="future">{FUTURE.map(([t, d]) => <li key={t}><b>{t}</b><span className="muted"> — {d}</span></li>)}</ul>
        </div>
      </div>
    </>
  );
}
