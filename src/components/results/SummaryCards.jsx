import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const { Scan, Nodule } = base44.entities;

function Card({ label, value, sub }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-mono text-2xl mt-1 tracking-tight">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function SummaryCards({ scanIds, settings }) {
  const q = useQuery({
    queryKey: ['resultsSummary', scanIds.join(',')],
    queryFn: async () => {
      const inScans = { scan: { $in: scanIds } };
      const [measured, aiTotal, aiChanged, agg] = await Promise.all([
        Nodule.count({ ...inScans, status: 'Accepted' }),
        Nodule.count({ ...inScans, source: 'AI' }),
        Nodule.count({ ...inScans, source: 'AI', was_edited: true }),
        Scan.aggregate({ query: { review_status: 'Approved' }, groupBy: 'timepoint', avg: 'minutes_on_scan' }),
      ]);
      let b = null, fSum = 0, fCnt = 0;
      (agg.rows || []).forEach((r) => {
        if (r.timepoint === 'Baseline') b = r.avg_minutes_on_scan;
        else if (r.avg_minutes_on_scan != null) { fSum += r.avg_minutes_on_scan * r.count; fCnt += r.count; }
      });
      return { measured, pct: aiTotal ? Math.round((aiChanged / aiTotal) * 100) : null, b, f: fCnt ? fSum / fCnt : null };
    },
  });
  const d = q.data;
  const m = (v) => (v == null ? '—' : Math.round(v));
  return (
    <div className="grid grid-cols-4 gap-3">
      <Card label="Scans approved" value={scanIds.length} />
      <Card label="Nodules measured" value={d?.measured ?? '…'} />
      <Card label="AI nodules changed" value={d ? (d.pct == null ? '—' : `${d.pct}%`) : '…'} sub="by the reviewer" />
      <Card label="Avg minutes / scan" value={d ? `${m(d.b)} · ${m(d.f)}` : '…'}
        sub={`Baseline ${m(d?.b)} min vs ${settings.baseline_minutes_baseline} before · Follow-up ${m(d?.f)} min vs ${settings.baseline_minutes_followup} before`} />
    </div>
  );
}