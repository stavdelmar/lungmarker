import { volumeOf } from '@/lib/patientTracks';

const sgn = (v) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(1)}`;

export default function PatientSummaryTable({ patients }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
          <tr>{['Patient ID', 'Nodules', 'Scans approved', 'Largest change in long axis', 'Volumes recorded'].map((h) => <th key={h} className="text-left font-medium px-3 py-2">{h}</th>)}</tr>
        </thead>
        <tbody>
          {patients.map((p) => {
            const changes = p.tracks.map((t) => t.long?.abs).filter((v) => v != null);
            const big = changes.length ? changes.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a)) : null;
            const cells = p.tracks.flatMap((t) => t.cells.filter(Boolean));
            return (
              <tr key={p.patient_id} onClick={() => document.getElementById(`patient-${p.patient_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer">
                <td className="px-3 py-2 font-mono">{p.patient_id}</td>
                <td className="px-3 font-mono">{p.tracks.length}</td>
                <td className="px-3 font-mono">{p.timepoints.length}</td>
                <td className="px-3 font-mono">{big == null ? '—' : `${sgn(big)} mm`}</td>
                <td className="px-3 text-xs">{cells.filter((n) => volumeOf(n) != null).length} of {cells.length}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}