import { useState, type FormEvent } from 'react';
import { repo } from '../services/repo';
import { friendlyError } from '../utils/format';

export default function Login() {
  const demo = repo.mode === 'demo';
  const [email, setEmail] = useState(demo ? 'admin@queueless.demo' : '');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null);
    if (!email.trim() || (!demo && !password)) return setErr('Enter your staff email and password.');
    setBusy(true);
    try { await repo.signIn(email.trim(), password); } catch (x) { setErr(friendlyError(x)); } finally { setBusy(false); }
  }
  return (
    <div className="login-wrap">
      <form className="login card" onSubmit={submit}>
        <div className="brand dark"><span className="logo">Q</span><div><b>QueueLess</b><small>Staff Console</small></div></div>
        <h2>Welcome back</h2>
        <p className="muted">Skip the line. Get things done.</p>
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username" /></label>
        <label>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" placeholder={demo ? 'Any password works in demo mode' : ''} /></label>
        {err && <div className="banner error">{err}</div>}
        <button className="btn primary wide" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        {demo && <p className="muted small">Demo mode: running on built-in sample data, no Firebase needed.</p>}
      </form>
    </div>
  );
}
