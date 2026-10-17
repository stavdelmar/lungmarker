import { List, HelpCircle } from 'lucide-react';
import { CENTRAL } from '@/lib/reviewChecks';
import { uncertainty } from '@/lib/uncertainty';

const GREEN = 'bg-emerald-50 text-emerald-800 border-emerald-300';
const AMBER = 'bg-amber-100 text-amber-900 border-amber-400';
const GREY = 'bg-slate-100 text-slate-700 border-slate-300';

// Compact nodule picker. Green = decided, amber = AI unsure (only), grey = pending.
export default function NoduleChips({ nodules, selId, onSelect, central, onList }) {
  const tip = (cls) => (cls.includes('emerald') ? 'Decided' : cls.includes('amber') ? 'AI unsure about the edges' : 'Not decided yet');
  const chip = (key, content, cls, on, click) => (
    <button key={key} onClick={click} title={tip(cls)} className={`h-7 min-w-10 px-2.5 rounded-full border text-xs font-mono whitespace-nowrap flex items-center justify-center gap-1 ${cls} ${on ? 'ring-2 ring-slate-900 ring-offset-1' : ''}`}>{content}</button>
  );
  const found = nodules.filter((n) => n.kind !== 'prior_not_found');
  const gone = nodules.filter((n) => n.kind === 'prior_not_found');
  const label = 'text-[11px] text-slate-500 whitespace-nowrap';
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-white border-b border-slate-200">
      <span className={label}>This scan:</span>
      {found.map((n) => chip(n.id, n.nodule_label, n.status !== 'Pending' ? GREEN : uncertainty(n).unsure ? AMBER : GREY, n.id === selId, () => onSelect(n)))}
      {central && chip(CENTRAL, 'Central', central.done ? GREEN : GREY, selId === CENTRAL, () => onSelect({ id: CENTRAL }))}
      {gone.length > 0 && <span className={`${label} ml-2`}>From Baseline:</span>}
      {gone.map((n) => chip(n.id, <><HelpCircle className="w-3.5 h-3.5 shrink-0" />Baseline {n.prior_label}: missing?</>,
        `border-dashed ${n.status !== 'Pending' ? GREEN : 'bg-white text-slate-700 border-slate-400'}`, n.id === selId, () => onSelect(n)))}
      <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-500 whitespace-nowrap">
        <span className="w-2 h-2 rounded-full bg-amber-400" />AI unsure · <span className="w-2 h-2 rounded-full bg-emerald-500" />decided
      </span>
      <button onClick={onList} className="h-7 px-2 rounded text-xs text-slate-600 hover:bg-slate-100 flex items-center gap-1 whitespace-nowrap"><List className="w-3.5 h-3.5" />List view</button>
    </div>
  );
}