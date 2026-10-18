import { minutesOnScan } from '@/lib/minutes';

// "Before 45 → with the tool 9 min (−80%) · n = 1 scan" for one timepoint group.
export default function MinutesCompare({ label, before, scans }) {
  const v = scans.map(minutesOnScan).filter((x) => x != null);
  const n = v.length;
  const now = n ? Math.round(v.reduce((a, b) => a + b, 0) / n) : null;
  const pct = before && now != null ? Math.round(((now - before) / before) * 100) : null;
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm py-2 border-t border-slate-100 first:border-t-0">
      <span className="w-20 text-xs font-medium text-slate-700">{label}</span>
      {n === 0 ? <span className="text-xs text-slate-400">no scans yet</span> : <>
        <span className="text-slate-700">
          Before <span className="font-mono">{before ?? '—'}</span> → with the tool <span className="font-mono font-semibold text-slate-900">{now}</span> min
          {pct != null && <span className={`font-mono ml-1 ${pct <= 0 ? 'text-emerald-700' : 'text-red-700'}`}>({pct > 0 ? '+' : '−'}{Math.abs(pct)}%)</span>}
          <span className="text-slate-500"> · n = {n} scan{n === 1 ? '' : 's'}</span>
        </span>
        {n < 5 && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[11px] text-slate-600">small sample, not yet a reliable comparison</span>}
      </>}
    </div>
  );
}