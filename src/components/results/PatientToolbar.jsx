import { volumeOf } from '@/lib/patientTracks';
import { isBeyond } from '@/components/results/TrackCard';
import SearchBox from '@/components/results/SearchBox';

export const FILTERS = [
  ['beyond', 'Change beyond noise', (p) => p.tracks.some((t) => t.long?.abs != null && isBeyond(t))],
  ['within', 'Within noise', (p) => p.tracks.some((t) => t.long?.abs != null && !isBeyond(t))],
  ['notFound', 'Has not-found nodules', (p) => p.tracks.some((t) => t.notFoundAt != null)],
  ['missingVol', 'Missing volumes', (p) => p.tracks.some((t) => t.cells.some((n) => n && volumeOf(n) == null))],
];

export const largestChange = (p) => Math.max(-1, ...p.tracks.map((t) => (t.long?.abs != null ? Math.abs(t.long.abs) : -1)));

export default function PatientToolbar({ q, setQ, active, setActive, sort, setSort, shown, total }) {
  const toggle = (k) => setActive((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchBox value={q} onChange={setQ} />
      {FILTERS.map(([k, label]) => (
        <button key={k} onClick={() => toggle(k)} className={`h-7 px-3 rounded-full text-xs border whitespace-nowrap ${active.includes(k) ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>{label}</button>
      ))}
      <div className="ml-auto flex items-center gap-3 whitespace-nowrap">
        <span className="text-xs text-slate-500">Showing {shown} of {total} patients</span>
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          Sort by:
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-7 pl-1.5 pr-1 rounded border-0 bg-transparent text-xs font-medium text-slate-800 hover:bg-slate-100 cursor-pointer">
            <option value="change">Biggest change</option>
            <option value="id">Patient ID</option>
          </select>
        </label>
      </div>
    </div>
  );
}