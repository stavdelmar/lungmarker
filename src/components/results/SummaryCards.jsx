import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const { Nodule } = base44.entities;

function Card({ label, value, sub }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-mono text-2xl mt-1 tracking-tight">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

// Minutes per scan, averaged by Baseline / Follow-up, for both clocks.
// total = open → approved (Daniel's own definition, fair vs his log); active = without idle time.
function avgMinutes(scans) {
  const acc = { b: { total: [], active: [] }, f: { total: [], active: [] } };
  scans.forEach((s) => {
    const k = s.timepoint === 'Baseline' ? 'b' : 'f';
    if (s.minutes_on_scan != null) acc[k].total.push(s.minutes_on_scan);
    if (s.active_minutes != null) acc[k].active.push(s.active_minutes);
  });
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  return { b: { total: avg(acc.b.total), active: avg(acc.b.active) }, f: { total: avg(acc.f.total), active: avg(acc.f.active) } };
}

export default function SummaryCards({ scanIds, scans = [], settings }) {
  const q = useQuery({
    queryKey: ['resultsSummary', scanIds.join(',')],
    queryFn: async () => {
      const inScans = { scan: { $in: scanIds } };
      const [measured, aiTotal, aiChanged] = await Promise.all([
        Nodule.count({ ...inScans, status: 'Accepted' }),
        Nodule.count({ ...inScans, source: 'AI' }),
        Nodule.count({ ...inScans, source: 'AI', was_edited: true }),
      ]);
      return { measured, pct: aiTotal ? Math.round((aiChanged / aiTotal) * 100) : null };
    },
  });
  const d = q.data;
  const t = avgMinutes(scans);
  const m = (v) => (v == null ? '—' : Math.round(v));
  const line = (label, x, before) => (
    <div className="flex items-baseline gap-2 text-[12px]">
      <span className="w-16 text-slate-500">{label}</span>
      <span className="font-mono text-base text-slate-900">{m(x.total)}</span><span className="text-slate-500">total</span>
      <span className="font-mono text-slate-700">{m(x.active)}</span><span className="text-slate-500">active</span>
      <span className="ml-auto text-slate-500">vs <span className="font-mono">{before}</span> before</span>
    </div>
  );
  return (
    <div className="grid grid-cols-4 gap-3">
      <Card label="Scans approved" value={scanIds.length} />
      <Card label="Nodules measured" value={d?.measured ?? '…'} />
      <Card label="AI nodules changed" value={d ? (d.pct == null ? '—' : `${d.pct}%`) : '…'} sub="by the reviewer" />
      <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
        <div className="text-[11px] uppercase tracking-wider text-slate-500">Avg minutes / scan</div>
        <div className="mt-1.5 space-y-1">
          {line('Baseline', t.b, settings.baseline_minutes_baseline)}
          {line('Follow-up', t.f, settings.baseline_minutes_followup)}
        </div>
        <div className="text-[10.5px] text-slate-500 mt-1.5 leading-snug">Total = opening the scan to approval, the same as the lab's "Minutes on scan" (and what is exported). Active = without idle time.</div>
      </div>
    </div>
  );
}