import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ReferenceArea, Tooltip, ResponsiveContainer } from 'recharts';
import { NOISE_LONG_MM } from '@/components/results/TrackCard';

// x = long axis at the earlier scan, y = change in long axis. Click a dot to scroll to its card.
export default function ChangeScatter({ patients }) {
  const data = patients.flatMap((p) => p.tracks.filter((t) => t.long?.abs != null).map((t) => {
    const first = t.cells.find(Boolean);
    return { x: first.long_axis_mm, y: +t.long.abs.toFixed(1), key: t.key, label: `${p.patient_id} ${t.labels.join('→')}` };
  }));
  if (!data.length) return <div className="bg-white border border-slate-200 rounded-lg p-4 text-xs text-slate-400">No matched nodules with a follow-up value yet.</div>;
  const go = (d) => document.getElementById(`track-${d.payload?.key ?? d.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="text-xs font-medium text-slate-700 mb-1">Change in long axis vs size at earlier scan</div>
      <ResponsiveContainer width="100%" height={240}>
        <ScatterChart margin={{ top: 10, right: 16, bottom: 20, left: 0 }}>
          <CartesianGrid stroke="#f1f5f9" />
          <ReferenceArea y1={-NOISE_LONG_MM} y2={NOISE_LONG_MM} fill="#e2e8f0" fillOpacity={0.6} label={{ value: 'expert measurement noise', position: 'insideTopRight', fontSize: 10, fill: '#64748b' }} />
          <XAxis type="number" dataKey="x" name="Long axis" unit=" mm" fontSize={11} label={{ value: 'Long axis at earlier scan (mm)', position: 'insideBottom', offset: -10, fontSize: 11 }} />
          <YAxis type="number" dataKey="y" name="Change" unit=" mm" fontSize={11} domain={[(m) => Math.min(m, -4), (m) => Math.max(m, 4)]} />
          <Tooltip formatter={(v, name) => [`${v} mm`, name]} labelFormatter={() => ''} content={({ payload }) => payload?.[0] ? <div className="bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono">{payload[0].payload.label}: {payload[0].payload.y} mm</div> : null} />
          <Scatter data={data} fill="#0f172a" onClick={go} cursor="pointer" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}