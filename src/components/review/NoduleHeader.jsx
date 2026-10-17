import { ChevronLeft, ChevronRight } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { fmtMaybe } from '@/components/review/viewerUtils';

// Header of the current-nodule card: "N1 · LUL · 4.6 × 4.6 mm · 1 of 4" with ‹ › to step through the list.
export default function NoduleHeader({ sel: current, nodules, onSelect }) {
  const i = nodules.findIndex((n) => n.id === current.id);
  const sel = nodules[i] || current; // same saved values as the list
  const nf = sel.kind === 'prior_not_found';
  const go = (d) => { const t = nodules[i + d]; if (t) onSelect(t); };
  const arrow = 'w-7 h-7 rounded-md border border-slate-300 bg-white grid place-items-center hover:bg-slate-50 disabled:opacity-30';
  return (
    <div className="shrink-0 flex items-center gap-2 px-4 h-12 bg-slate-100 border-b border-slate-200">
      <button className={arrow} disabled={i <= 0} onClick={() => go(-1)} title="Previous"><ChevronLeft className="w-4 h-4" /></button>
      <div className="flex-1 min-w-0 truncate text-sm">
        <span className="font-mono font-semibold text-base">{nf ? `Prior ${sel.prior_label}` : sel.nodule_label}</span>
        <span className="text-slate-600"> · {sel.lobe || '—'}{!nf && <> · <span className="font-mono">{fmtMaybe(sel.long_axis_mm)} × {fmtMaybe(sel.short_axis_mm)}</span> mm</>} · {i + 1} of {nodules.length}</span>
      </div>
      <StatusBadge status={nf && sel.status === 'Accepted' ? 'Not found' : sel.status} />
      <button className={arrow} disabled={i >= nodules.length - 1} onClick={() => go(1)} title="Next"><ChevronRight className="w-4 h-4" /></button>
    </div>
  );
}