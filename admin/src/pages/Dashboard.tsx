import { useNavigate } from 'react-router-dom';
import { BarChart, PageHeader, StatCard } from '../components/Common';
import { QueueCard } from '../components/QueueCard';
import { useData } from '../context/DataContext';

export default function Dashboard() {
  const { services, queues, stats } = useData();
  const nav = useNavigate();
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Live overview of every campus queue. Updates in real time." />
      <div className="grid4">
        <StatCard label="Active Queues" value={stats.activeQueues} accent="#2F4BFF" />
        <StatCard label="Students Waiting" value={stats.waiting} accent="#F5A524" />
        <StatCard label="Tokens Served Today" value={stats.served} accent="#12A150" />
        <StatCard label="Average Wait" value={`${stats.avgWaitMin} min`} hint="Token issued → called" accent="#8A4DFF" />
      </div>
      <h2 className="section">Queue control</h2>
      <div className="grid2">
        {services.filter((s) => s.active).map((s) => {
          const q = queues.find((x) => x.serviceId === s.id); if (!q) return null;
          return <QueueCard key={s.id} service={s} queue={q} onOpen={() => nav(`/queues?service=${s.id}`)} />;
        })}
        {services.length === 0 && <div className="card">No services yet. Go to <b>Settings → Load demo data</b> or add one under <b>Services</b>.</div>}
      </div>
      <div className="card" style={{ marginTop: 20 }}>
        <h3>Tokens issued today, by hour</h3>
        <BarChart data={stats.hourly} />
      </div>
    </>
  );
}
