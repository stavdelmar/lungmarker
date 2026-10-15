import { fmt1 } from '@/lib/data';

const pct = (a, b) => (a == null || b == null || !b ? '—' : `${(((a - b) / b) * 100).toFixed(1)}%`);
const sign = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}`);

export default function ChangeSummary({ scans, nodules }) {
  const rows = [];
  scans.filter((s) => s.timepoint !== 'Baseline').forEach((fs) => {
    const ps = scans.find((s) => s.engine_scan_id === fs.prior_engine_scan_id);
    if (!ps) return;
    nodules.filter((n) => n.scan === fs.id && n.match_to_prior && n.match_to_prior !== 'N/A').forEach((n) => {
      const p = nodules.find((x) => x.scan === ps.id && x.nodule_label === n.match_to_prior);
      if (!p) return;
      const vOk = n.outline_confirmed && p.outline_confirmed && n.volume_mm3 != null && p.volume_mm3 != null;
      rows.push({ key: n.id, patient: fs.patient_id, from: ps.timepoint, to: fs.timepoint, label: `${p.nodule_label} → ${n.nodule_label}`, pm: p.mean_diameter_mm, nm: n.mean_diameter_mm, pv: vOk ? p.volume_mm3 : null, nv: vOk ? n.volume_mm3 : null });
    });
  });
  if (!rows.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-100">Change in matched nodules (approved timepoints)</div>
      <table className="w-full text-sm">
        <thead className="text-[11px] text-slate-500"><tr>{['Patient', 'Timepoints', 'Nodule', 'Mean diameter mm', 'Δ mm', 'Δ %', 'Volume mm³', 'Δ mm³', 'Δ %'].map((h) => <th key={h} className="text-left font-medium px-4 py-2">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-slate-100 font-mono text-xs">
              <td className="px-4 py-2">{r.patient}</td><td className="px-4 font-sans">{r.from} → {r.to}</td><td className="px-4">{r.label}</td>
              <td className="px-4">{fmt1(r.pm)} → {fmt1(r.nm)}</td><td className="px-4">{sign(r.nm != null && r.pm != null ? r.nm - r.pm : null)}</td><td className="px-4">{pct(r.nm, r.pm)}</td>
              <td className="px-4">{r.pv == null ? '—' : `${Math.round(r.pv)} → ${Math.round(r.nv)}`}</td><td className="px-4">{r.pv == null ? '—' : sign(r.nv - r.pv)}</td><td className="px-4">{pct(r.nv, r.pv)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}