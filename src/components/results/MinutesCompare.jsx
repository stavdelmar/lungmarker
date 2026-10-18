import { minutesOnScan } from '@/lib/minutes';

const MAX = 60;
const x = (m) => `${(Math.min(Math.max(m, 0), MAX) / MAX) * 100}%`;
const median = (v) => { const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const scanMinutes = (scans) => scans.map(minutesOnScan).filter((v) => v != null);

// One dumbbell row: grey = before, dark = median with the tool, small dots = each scan, dashed = target (half).
export default function MinutesCompare({ label, before, values }) {
  const n = values.length;
  const now = n ? Math.round(median(values)) : null;
  const pct = before && now != null ? Math.round(((now - before) / before) * 100) : null;
  const lo = now != null ? Math.min(before ?? now, now) : null;
  const hi = now != null ? Math.max(before ?? now, now) : null;
  return (
    <div className="flex items-center gap-3 h-14">
      <span className="w-20 text-xs font-medium text-slate-700">{label}</span>
      <div className="relative flex-1 h-full">
        <div className="absolute inset-x-0 top-1/2 h-px bg-slate-100" />
        {before != null && <>
          <div className="absolute top-2 bottom-2 border-l border-dashed border-slate-400" style={{ left: x(before / 2) }} />
          <span className="absolute top-0 -translate-x-1/2 text-[10px] text-slate-400 whitespace-nowrap" style={{ left: x(before / 2) }}>Target: half</span>
        </>}
        {now != null && before != null && <>
          <div className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-slate-400" style={{ left: x(lo), width: `calc(${x(hi)} - ${x(lo)})` }} />
          {pct != null && <span className={`absolute bottom-0 -translate-x-1/2 text-[11px] font-mono ${pct <= 0 ? 'text-emerald-700' : 'text-red-700'}`} style={{ left: x((lo + hi) / 2) }}>{pct > 0 ? '+' : '−'}{Math.abs(pct)}%</span>}
        </>}
        {values.map((v, i) => <div key={i} title={`${v} min`} className="absolute top-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900/25" style={{ left: x(v) }} />)}
        {before != null && <div title={`Before: ${before} min`} className="absolute top-1/2 w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-400 ring-2 ring-white" style={{ left: x(before) }} />}
        {now != null && <div title={`With the tool (median): ${now} min`} className="absolute top-1/2 w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900 ring-2 ring-white" style={{ left: x(now) }} />}
      </div>
      <span className="w-24 text-xs text-slate-500 font-mono">{n ? `n = ${n}` : <span className="font-sans text-slate-400">no scans yet</span>}</span>
    </div>
  );
}