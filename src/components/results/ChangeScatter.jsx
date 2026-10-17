import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ReferenceArea, ReferenceLine, Tooltip, ResponsiveContainer } from 'recharts';
import { NOISE_LONG_MM } from '@/components/results/TrackCard';

const tickTxt = (v) => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : '0');

// x = long axis at the earlier scan, y = change in long axis. Click a dot to scroll to its card.
export default function ChangeScatter({ patients }) {
  const data = patients.flatMap((p) => p.tracks.filter((t) => t.long?.abs != null).map((t) => {
    const first = t.cells.find(Boolean);
    return { x: first.long_axis_mm, y: +t.long.abs.toFixed(1), key: t.key, label: `${p.patient_id} ${t.labels.join('→')}` };
  }));
  const note = <p className="text-[11px] text-slate-500">Noise thresholds (expert inter-reader): long axis &gt; 2.3 mm or volume &gt; 17%.</p>;
  if (!data.length) return <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-1"><div className="text-xs text-slate-400">No matched nodules with a follow-up value.</div>{note}</div>;
  // Symmetric round axis with headroom so edge dots aren't clipped.
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.y)));
  const step = maxAbs > 20 ? 10 : 5;
  const M = Math.max(step, Math.ceil((maxAbs + 0.5) / step) * step);
  const ticks = Array.from({ length: (2 * M) / step + 1 }, (_, i) => -M + i * step);
  const go = (d) => document.getElementById(`track-${d.payload?.key ?? d.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-1">
        <div className="text-xs font-medium text-slate-700">Change in long axis vs size at earlier scan</div>
        {note}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ top: 12, right: 20, bottom: 28, left: 12 }}>
          <CartesianGrid stroke="#f1f5f9" />
          <ReferenceArea y1={-NOISE_LONG_MM} y2={NOISE_LONG_MM} fill="#e2e8f0" fillOpacity={0.7} ifOverflow="visible"
            label={{ value: 'expert measurement noise (±2.3 mm)', position: 'insideTopLeft', fontSize: 10, fill: '#475569' }} />
          <ReferenceLine y={0} stroke="#475569" strokeWidth={1.25} />
          <XAxis type="number" dataKey="x" unit=" mm" fontSize={11} domain={[0, 'auto']} padding={{ left: 12, right: 12 }}
            label={{ value: 'Long axis at earlier scan (mm)', position: 'insideBottom', offset: -16, fontSize: 11 }} />
          <YAxis type="number" dataKey="y" fontSize={11} domain={[-M, M]} ticks={ticks} tickFormatter={tickTxt} width={44}
            label={{ value: 'Change (mm)', angle: -90, position: 'insideLeft', offset: 0, fontSize: 11, style: { textAnchor: 'middle' } }} />
          <Tooltip cursor={false} content={({ payload }) => payload?.[0] ? <div className="bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono">{payload[0].payload.label}: {tickTxt(payload[0].payload.y)} mm</div> : null} />
          <Scatter data={data} fill="#0f172a" onClick={go} cursor="pointer" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}