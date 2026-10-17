import { List, HelpCircle } from 'lucide-react';
import { CENTRAL } from '@/lib/reviewChecks';
import { tone } from '@/lib/noduleTone';

// Same colour rule as the image outlines and slice-bar marks.
const CLS = {
  selected: 'bg-teal-100 text-teal-900 border-teal-500 ring-2 ring-teal-500 ring-offset-1',
  accepted: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  rejected: 'bg-white text-red-700 border-red-400 border-dashed',
  unsure: 'bg-amber-100 text-amber-900 border-amber-400',
  pending: 'bg-slate-100 text-slate-700 border-slate-300',
};
const TIP = { selected: 'Selected', accepted: 'Accepted', rejected: 'Rejected', unsure: 'AI unsure about the edges', pending: 'Not decided yet' };
const Dot = ({ c }) => <span className={`w-2 h-2 rounded-full ${c}`} />;

export default function NoduleChips({ nodules, selId, onSelect, central, onList, priorTimepoint = 'Prior' }) {
  const chip = (key, content, t, click, extra = '') => (
    <button key={key} onClick={click} title={TIP[t]} className={`h-7 min-w-10 px-2.5 rounded-full border text-xs font-mono whitespace-nowrap flex items-center justify-center gap-1 ${CLS[t]} ${extra}`}>{content}</button>
  );
  const found = nodules.filter((n) => n.kind !== 'prior_not_found');
  const gone = nodules.filter((n) => n.kind === 'prior_not_found');
  const label = 'text-[11px] text-slate-500 whitespace-nowrap';
  const name = (n) => (n.match_to_prior && n.match_to_prior !== 'N/A' ? `${n.nodule_label} = ${priorTimepoint} ${n.match_to_prior}` : n.nodule_label);
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-white border-b border-slate-200">
      <span className={label}>This scan:</span>
      {found.map((n) => chip(n.id, name(n), tone(n, selId), () => onSelect(n)))}
      {central && chip(CENTRAL, 'Central', selId === CENTRAL ? 'selected' : central.done ? 'accepted' : 'pending', () => onSelect({ id: CENTRAL }))}
      {gone.length > 0 && <span className={`${label} ml-2`}>From Baseline:</span>}
      {gone.map((n) => chip(n.id, <><HelpCircle className="w-3.5 h-3.5 shrink-0" />Baseline {n.prior_label}: missing?</>,
        n.id === selId ? 'selected' : n.status !== 'Pending' ? 'accepted' : 'pending', () => onSelect(n), 'border-dashed'))}
      <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-500 whitespace-nowrap">
        <Dot c="bg-teal-400" />selected · <Dot c="bg-slate-400" />pending · <Dot c="bg-amber-400" />AI unsure · <Dot c="bg-emerald-500" />accepted · <span className="w-3 border-t-2 border-dashed border-red-400" />rejected
      </span>
      <button onClick={onList} className="h-7 px-2 rounded text-xs text-slate-600 hover:bg-slate-100 flex items-center gap-1 whitespace-nowrap"><List className="w-3.5 h-3.5" />List view</button>
    </div>
  );
}