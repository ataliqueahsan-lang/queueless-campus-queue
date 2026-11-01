import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DataProvider, useData } from './context/DataContext';
import Analytics from './pages/Analytics';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Queues from './pages/Queues';
import Services from './pages/Services';
import Settings from './pages/Settings';
import Students from './pages/Students';

function Gate() {
  const { user, authLoading } = useData();
  if (authLoading) return <div className="center muted">Loading…</div>;
  if (!user) return <Login />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="queues" element={<Queues />} />
        <Route path="services" element={<Services />} />
        <Route path="students" element={<Students />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
export default function App() {
  return <BrowserRouter><DataProvider><Gate /></DataProvider></BrowserRouter>;
}
