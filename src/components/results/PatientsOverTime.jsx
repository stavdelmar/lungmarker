import { Info } from 'lucide-react';
import { patientTracks } from '@/lib/patientTracks';
import TrackCard from '@/components/results/TrackCard';

export default function PatientsOverTime({ scans, nodules, base }) {
  const patients = patientTracks(scans, nodules).filter((p) => p.timepoints.length > 0);
  if (!patients.length) return <p className="py-10 text-center text-sm text-slate-400">No approved scans yet.</p>;
  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-500">Noise thresholds (expert inter-reader): long axis &gt; 2.3 mm or volume &gt; 17%.</p>
      {patients.map((p) => (
        <section key={p.patient_id} className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-mono font-medium">{p.patient_id}</span>
            <span className="text-xs text-slate-500">{p.timepoints.map((s) => `${s.timepoint} ${String(s.scan_date || '').slice(0, 10)}`).join(' → ')}</span>
          </div>
          {p.sameDay && (
            <div className="text-[12px] text-sky-900 bg-sky-50 border border-sky-200 rounded px-2 py-1 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0" />Same-day repeat scan (RIDER test–retest): changes show measurement repeatability, not growth.
            </div>
          )}
          {p.tracks.map((t) => <TrackCard key={t.key} track={t} timepoints={p.timepoints} base={base} />)}
          {!p.tracks.length && <p className="text-xs text-slate-400">No accepted nodules.</p>}
        </section>
      ))}
    </div>
  );
}