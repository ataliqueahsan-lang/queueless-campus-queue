import { BarChart, PageHeader, StatCard } from '../components/Common';
import { useData } from '../context/DataContext';

export default function Analytics() {
  const { stats, queues } = useData();
  return (
    <>
      <PageHeader title="Analytics" subtitle="Today’s usage across campus. Live data from Firestore." />
      <div className="grid4">
        <StatCard label="Tokens Served Today" value={stats.served} accent="#12A150" />
        <StatCard label="Average Waiting Time" value={`${stats.avgWaitMin} min`} accent="#8A4DFF" />
        <StatCard label="Current Queue Length" value={stats.waiting} accent="#F5A524" />
        <StatCard label="Peak Usage Period" value={<span style={{ fontSize: 20 }}>{stats.peakLabel}</span>} accent="#2F4BFF" />
      </div>
      <div className="grid2" style={{ marginTop: 20 }}>
        <div className="card"><h3>Service usage (tokens today)</h3><BarChart data={stats.usage} color="#2F4BFF" /></div>
        <div className="card"><h3>Current queue length by service</h3>
          <BarChart data={queues.map((q) => ({ label: q.serviceId, value: q.waitingNumbers.length }))} color="#F5A524" />
        </div>
      </div>
      <div className="card" style={{ marginTop: 20 }}><h3>Tokens issued by hour</h3><BarChart data={stats.hourly} color="#12A150" /></div>
    </>
  );
}
