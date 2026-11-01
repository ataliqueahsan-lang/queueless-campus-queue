import { PageHeader, TokenBadge } from '../components/Common';
import { useData } from '../context/DataContext';
import { isActive } from '../utils/queueLogic';

export default function Students() {
  const { students, tokens } = useData();
  return (
    <>
      <PageHeader title="Students" subtitle="Registered students and their tokens today." />
      <div className="card" style={{ overflowX: 'auto' }}>
        {students.length === 0 ? <p className="muted">No students have registered yet.</p> : (
          <table>
            <thead><tr><th>Name</th><th>Student ID</th><th>Email</th><th>Tokens today</th><th>Active token</th></tr></thead>
            <tbody>
              {students.map((s) => {
                const mine = tokens.filter((t) => t.userId === s.uid);
                const active = mine.find((t) => isActive(t.status));
                return (
                  <tr key={s.uid}>
                    <td><b>{s.name}</b></td><td>{s.studentId}</td><td>{s.email}</td><td>{mine.length}</td>
                    <td>{active ? <>#{active.tokenNumber} {active.serviceName} <TokenBadge status={active.status} /></> : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
