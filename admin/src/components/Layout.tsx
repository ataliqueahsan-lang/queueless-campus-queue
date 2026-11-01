import { NavLink, Outlet } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { repo } from '../services/repo';

const NAV = [
  ['/', 'Dashboard', '▦'], ['/queues', 'Queues', '☰'], ['/services', 'Services', '◈'],
  ['/students', 'Students', '☺'], ['/analytics', 'Analytics', '▤'], ['/settings', 'Settings', '⚙'],
] as const;

export function Layout() {
  const { user, error, toast } = useData();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="logo">Q</span><div><b>QueueLess</b><small>Staff Console</small></div></div>
        <nav>
          {NAV.map(([to, label, icon]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => 'nav' + (isActive ? ' active' : '')}>
              <span className="nav-icon">{icon}</span>{label}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div className="who">{user?.name}<small>{user?.email}</small></div>
          {repo.mode === 'demo' && <span className="badge qs-paused">Demo mode</span>}
          <button className="btn ghost light" onClick={() => repo.signOut()}>Sign out</button>
          <small className="tag">Smarter Campus. Together.</small>
        </div>
      </aside>
      <main className="content">
        {error && <div className="banner error">⚠️ {error}</div>}
        <Outlet />
        {toast && <div className="toast">{toast}</div>}
      </main>
    </div>
  );
}
