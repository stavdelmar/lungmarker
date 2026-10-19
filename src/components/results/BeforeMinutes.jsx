const MAX = 60;
const x = (m) => `${(Math.min(Math.max(m, 0), MAX) / MAX) * 100}%`;

// One row of the "before" times (Daniel's own log, Settings). Time with the tool is not shown: no reader has been
// timed yet (Stav, 19 Oct — the tab must not contradict RESULTS.md). Dashed tick = the lab's target, half the time.
export default function BeforeMinutes({ label, before }) {
  return (
    <div className="flex items-center gap-3 h-12">
      <span className="w-20 text-xs font-medium text-slate-700">{label}</span>
      <div className="relative flex-1 h-full">
        <div className="absolute top-1/2 inset-x-0 h-px -translate-y-1/2 bg-slate-100" />
        {before != null && <>
          <div className="absolute top-1/2 h-3 -translate-y-1/2 border-l border-dashed border-slate-300" style={{ left: x(before / 2) }} title={`Target: ${Math.round(before / 2)} min`} />
          <div title={`Before: ${before} min`} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full w-3 h-3 bg-orange-600" style={{ left: x(before) }} />
        </>}
      </div>
      <span className="w-24 text-right text-xs text-slate-500">{before != null ? <span className="font-mono text-slate-800">{before} min</span> : <span className="text-slate-400">not set</span>}</span>
    </div>
  );
}
