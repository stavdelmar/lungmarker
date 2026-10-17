import { useState } from 'react';
import { Info } from 'lucide-react';
import { patientTracks } from '@/lib/patientTracks';
import TrackCard from '@/components/results/TrackCard';
import ChangeScatter from '@/components/results/ChangeScatter';
import PatientSummaryTable from '@/components/results/PatientSummaryTable';
import PatientToolbar, { FILTERS, largestChange } from '@/components/results/PatientToolbar';
import ResultDetail from '@/components/results/ResultDetail';

export default function PatientsOverTime({ scans, nodules, base }) {
  const [detail, setDetail] = useState(null);
  const [q, setQ] = useState('');
  const [active, setActive] = useState([]);
  const [sort, setSort] = useState('change');
  const all = patientTracks(scans, nodules).filter((p) => p.timepoints.length > 0);
  if (!all.length) return <p className="py-10 text-center text-sm text-slate-400">No approved scans yet.</p>;
  const patients = all
    .filter((p) => p.patient_id.toLowerCase().includes(q.trim().toLowerCase()))
    .filter((p) => FILTERS.every(([k, , test]) => !active.includes(k) || test(p)));
  if (sort === 'change') patients.sort((a, b) => largestChange(b) - largestChange(a));
  const scanOf = (n) => n && scans.find((s) => s.id === n.scan);
  return (
    <div className="space-y-5">
      <PatientToolbar q={q} setQ={setQ} active={active} setActive={setActive} sort={sort} setSort={setSort} shown={patients.length} total={all.length} />
      {!patients.length ? (
        <div className="py-10 text-center text-sm text-slate-500 bg-white border border-slate-200 rounded-lg">
          No patients match this search and filters.
          <button onClick={() => { setQ(''); setActive([]); }} className="ml-2 text-teal-700 hover:underline">Clear</button>
        </div>
      ) : <>
      <ChangeScatter patients={patients} />
      <PatientSummaryTable patients={patients} />
      {patients.map((p) => (
        <section key={p.patient_id} id={`patient-${p.patient_id}`} className="scroll-mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-mono font-medium">{p.patient_id}</span>
            <span className="text-xs text-slate-500">{p.timepoints.map((s) => `${s.timepoint} ${String(s.scan_date || '').slice(0, 10)}`).join(' → ')}</span>
          </div>
          {p.sameDay && (
            <div className="text-[12px] text-sky-900 bg-sky-50 border border-sky-200 rounded px-2 py-1 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0" />Same-day repeat scan (RIDER test–retest): changes show measurement repeatability only.
            </div>
          )}
          {p.tracks.map((t) => <TrackCard key={t.key} track={t} timepoints={p.timepoints} base={base} onOpen={setDetail} />)}
          {!p.tracks.length && <p className="text-xs text-slate-400">No accepted nodules.</p>}
        </section>
      ))}
      </>}
      <ResultDetail n={detail} scan={scanOf(detail)} base={base} onClose={() => setDetail(null)} />
    </div>
  );
}