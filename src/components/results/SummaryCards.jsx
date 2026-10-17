import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { countsText } from '@/lib/patientTracks';
import { useSummary } from '@/components/results/useSummary';

function Card({ label, children, sub }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 min-w-0">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-mono text-2xl mt-1 tracking-tight">{children}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

// Always-visible top cards of the Dashboard (all approved scans).
export default function SummaryCards({ scans }) {
  const totalQ = useQuery({ queryKey: ['scanCount'], queryFn: () => base44.entities.Scan.count({}) });
  const q = useSummary(scans);
  const d = q.data;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Card label="Scans approved">{scans.length} <span className="text-base text-slate-500">of {totalQ.data ?? '…'}</span></Card>
      <Card label="Nodules (incl. not found)" sub={d && <>{countsText(d.counts)}<br />Volumes recorded <b className="font-mono text-slate-800">{d.volumes}</b> of <span className="font-mono">{d.measured}</span> measurements <span className="text-slate-400">(only for confirmed outlines)</span></>}>
        {!scans.length ? 0 : d ? d.counts.nodules : (q.isError ? '—' : '…')}
      </Card>
    </div>
  );
}