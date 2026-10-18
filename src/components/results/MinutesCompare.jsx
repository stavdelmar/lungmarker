import { minutesOnScan } from '@/lib/minutes';

const MAX = 60;
const x = (m) => `${(Math.min(Math.max(m, 0), MAX) / MAX) * 100}%`;
const median = (v) => { const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const scanMinutes = (scans) => scans.map(minutesOnScan).filter((v) => v != null);
const dot = 'absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full';

// One dumbbell row: orange = before, blue = median with the tool, hollow = each scan, dashed tick = target (half).
export default function MinutesCompare({ label, before, values }) {
  const n = values.length;
  const now = n ? Math.round(median(values)) : null;
  const pct = before && now != null ? Math.round(((now - before) / before) * 100) : null;
  const both = now != null && before != null;
  const lo = both ? Math.min(before, now) : null;
  const hi = both ? Math.max(before, now) : null;
  return (
    <div className="flex items-center gap-3 h-14">
      <span className="w-20 text-xs font-medium text-slate-700">{label}</span>
      <div className="relative flex-1 h-full">
        {both && <>
          <div className="absolute top-1/2 h-px -translate-y-1/2 bg-slate-200" style={{ left: x(lo), width: `calc(${x(hi)} - ${x(lo)})` }} />
          <div className="absolute top-1/2 h-3 -translate-y-1/2 border-l border-dashed border-slate-300" style={{ left: x(before / 2) }} />
          {pct != null && <span className={`absolute top-1/2 -translate-x-1/2 -translate-y-[calc(100%+6px)] text-[11px] font-mono font-medium ${pct <= 0 ? 'text-green-600' : 'text-red-600'}`} style={{ left: x((lo + hi) / 2) }}>{pct > 0 ? '+' : '−'}{Math.abs(pct)}%</span>}
        </>}
        {values.map((v, i) => <div key={i} title={`${v} min`} className="absolute w-2 h-2 -translate-x-1/2 rounded-full border border-blue-600/60 bg-white" style={{ left: x(v), top: `calc(50% + ${5 + (i % 3) * 3}px)` }} />)}
        {before != null && <div title={`Before: ${before} min`} className={`${dot} w-3 h-3 bg-orange-600`} style={{ left: x(before) }} />}
        {now != null && <div title={`With the tool (median): ${now} min`} className={`${dot} w-3 h-3 bg-blue-600`} style={{ left: x(now) }} />}
      </div>
      <span className="w-24 text-right text-xs text-slate-500">{n ? <span className="font-mono">n = {n}</span> : <span className="text-slate-400">no scans yet</span>}</span>
    </div>
  );
}