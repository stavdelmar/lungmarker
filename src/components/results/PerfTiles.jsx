const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
const median = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function Tile({ label, value, sub }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">{label}</div>
      <div className="mt-1 text-2xl font-semibold font-mono">{value}</div>
      <div className="mt-0.5 text-xs text-slate-500">{sub}</div>
    </div>
  );
}

// Headline numbers for the Performance tab.
export default function PerfTiles({ d }) {
  const aiAll = d.unchanged + d.edited + d.rejected;
  const kept = d.unchanged + d.edited;
  const final = kept + d.added;
  const med = median(d.axisDeltas || []);
  return (
    <div className="grid grid-cols-4 gap-3">
      <Tile label="AI suggestions kept" value={pct(kept, aiAll)} sub={`${d.unchanged} unchanged + ${d.edited} edited of ${aiAll} AI findings, in scans reviewed so far`} />
      <Tile label="Added by the reviewer" value={d.added} sub={`of ${final} final nodules (${pct(d.added, final)}), in scans reviewed so far`} />
      <Tile label="Outline change, AI → approved" value={med == null ? '—' : `${med.toFixed(1)} mm`}
        sub={<>median long-axis change (expert noise 2.3 mm) · n = {(d.axisDeltas || []).length}</>} />
      <Tile label="Volumes recorded" value={`${d.volumes} of ${d.measured}`} sub={`${pct(d.volumes, d.measured)} of accepted nodules, in scans reviewed so far`} />
    </div>
  );
}