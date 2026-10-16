import { Info } from 'lucide-react';
import { fmt1 } from '@/lib/data';
import { patientTracks, volumeOf } from '@/lib/patientTracks';

const sgn = (v, d = 1) => (v == null ? '' : `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(d)}`);
const pctTxt = (p) => (p == null ? '' : `${sgn(p, 1)}%`);
const tpShort = (t) => (t === 'Baseline' ? 'Baseline' : t.replace('Follow-up ', 'FU '));

function Cell({ n, track, j }) {
  if (!n) {
    if (track.notFoundAt === j) return <span className="text-amber-700 font-sans text-[11px]">not found</span>;
    return <span className="text-slate-300">·</span>;
  }
  const v = volumeOf(n);
  return (
    <div className="leading-tight">
      <div><span className="text-slate-400 font-sans text-[10px] mr-1">{n.nodule_label}</span>{fmt1(n.long_axis_mm)} mm</div>
      <div className={v == null ? 'text-slate-400 font-sans text-[10.5px]' : ''}>{v == null ? 'outline not confirmed' : `${Math.round(v)} mm³`}</div>
    </div>
  );
}

function Change({ c, unit, digits = 1, missing }) {
  if (!c || c.abs == null) return <span className="text-slate-400 font-sans text-[10.5px]">{missing ? 'outline not confirmed' : '—'}</span>;
  return <span>{sgn(c.abs, digits)} {unit} <span className="text-slate-500">({pctTxt(c.pct)})</span></span>;
}

// Per patient, each nodule from Baseline through the follow-ups (linked by Daniel's "Match to prior"),
// with the change in long axis and volume. Volumes only where the outline was confirmed (Daniel's rule).
export default function PatientChanges({ scans, nodules }) {
  const patients = patientTracks(scans, nodules).filter((p) => p.timepoints.length > 0);
  if (!patients.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-800">By patient <span className="font-normal text-slate-500">· each nodule from Baseline to follow-up, as approved</span></h2>
      {patients.map((p) => {
        const many = p.timepoints.length > 1;
        return (
          <div key={p.patient_id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono font-medium">{p.patient_id}</span>
              <span className="text-xs text-slate-500">{p.timepoints.map((s) => `${s.timepoint} ${String(s.scan_date || '').slice(0, 10)}`).join(' → ')}</span>
              {p.sameDay && (
                <span className="text-[11.5px] text-sky-900 bg-sky-50 border border-sky-200 rounded px-2 py-0.5 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" />Same-day repeat scan (RIDER test–retest): changes show measurement repeatability, not growth.
                </span>
              )}
            </div>
            <table className="w-full text-sm">
              <thead className="text-[11px] text-slate-500">
                <tr>
                  <th className="text-left font-medium px-4 py-2">Nodule</th><th className="text-left font-medium px-3">Lobe</th>
                  {p.timepoints.map((s) => <th key={s.id} className="text-left font-medium px-3">{tpShort(s.timepoint)}</th>)}
                  {many && <><th className="text-left font-medium px-3">Change in long axis</th><th className="text-left font-medium px-3">Change in volume</th></>}
                </tr>
              </thead>
              <tbody>
                {p.tracks.map((t) => (
                  <tr key={t.key} className="border-t border-slate-100 font-mono text-xs align-top">
                    <td className="px-4 py-2 whitespace-nowrap">{t.labels.join(' → ')}{t.newAt != null && <span className="ml-1.5 font-sans text-[10.5px] text-teal-800 bg-teal-50 rounded px-1">new</span>}</td>
                    <td className="px-3 py-2">{t.lobe || '—'}</td>
                    {p.timepoints.map((s, j) => <td key={s.id} className="px-3 py-2"><Cell n={t.cells[j]} track={t} j={j} /></td>)}
                    {many && <>
                      <td className="px-3 py-2 whitespace-nowrap">{t.notFoundAt != null ? <span className="text-amber-700 font-sans text-[11px]">not found on {tpShort(p.timepoints[t.notFoundAt].timepoint)}</span> : t.newAt != null ? <span className="text-slate-400 font-sans text-[10.5px]">new on {tpShort(p.timepoints[t.newAt].timepoint)}</span> : <Change c={t.long} unit="mm" />}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{t.notFoundAt != null || t.newAt != null ? '' : <Change c={t.volume} unit="mm³" digits={0} missing={t.volumeMissing} />}</td>
                    </>}
                  </tr>
                ))}
                {!p.tracks.length && <tr><td colSpan={9} className="px-4 py-3 text-xs text-slate-400">No accepted nodules.</td></tr>}
              </tbody>
            </table>
          </div>
        );
      })}
    </section>
  );
}
