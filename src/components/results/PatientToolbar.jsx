import { Search } from 'lucide-react';
import { volumeOf } from '@/lib/patientTracks';
import { isBeyond } from '@/components/results/TrackCard';

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
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Patient ID" className="h-8 w-44 pl-7 pr-2 rounded-md border border-slate-200 bg-white text-sm" />
      </div>
      {FILTERS.map(([k, label]) => (
        <button key={k} onClick={() => toggle(k)} className={`h-7 px-3 rounded-full text-xs border whitespace-nowrap ${active.includes(k) ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>{label}</button>
      ))}
      <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-8 px-2 rounded-md border border-slate-200 bg-white text-sm">
        <option value="change">Largest change first</option>
        <option value="id">Patient ID</option>
      </select>
      <span className="ml-auto text-xs text-slate-500 whitespace-nowrap">Showing {shown} of {total} patients</span>
    </div>
  );
}