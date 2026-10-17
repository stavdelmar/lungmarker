import { List, HelpCircle, Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CENTRAL } from '@/lib/reviewChecks';
import { tone } from '@/lib/noduleTone';

// Colour = state (same rule as image outlines and slice-bar marks); selection = thick dark ring.
const CLS = {
  accepted: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  rejected: 'bg-white text-red-700 border-red-400 border-dashed',
  unsure: 'bg-amber-100 text-amber-900 border-amber-400',
  pending: 'bg-slate-100 text-slate-700 border-slate-300',
};
const TIP = { accepted: 'Accepted', rejected: 'Rejected', unsure: 'AI unsure about the edges', pending: 'Not decided yet' };
const Dot = ({ c }) => <span className={`w-2 h-2 rounded-full ${c}`} />;

function Legend() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button aria-label="Colour legend" className="text-slate-400 hover:text-slate-700"><Info className="w-3.5 h-3.5" /></button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3 text-xs text-slate-600 space-y-1.5">
        <div className="flex items-center gap-2"><Dot c="bg-slate-400" />Pending</div>
        <div className="flex items-center gap-2"><Dot c="bg-amber-400" />AI unsure about the edges</div>
        <div className="flex items-center gap-2"><Dot c="bg-emerald-500" />Accepted</div>
        <div className="flex items-center gap-2"><span className="w-3 border-t-2 border-dashed border-red-400" />Rejected</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full ring-2 ring-slate-900" />Selected</div>
      </PopoverContent>
    </Popover>
  );
}

export default function NoduleChips({ nodules, selId, onSelect, central, onList, priorTimepoint = 'Prior' }) {
  const chip = (key, content, t, click, tip, extra = '') => (
    <button key={key} onClick={click} title={`${tip} · ${TIP[t]}`} className={`h-7 min-w-10 px-2.5 rounded-full border text-xs font-mono whitespace-nowrap flex items-center justify-center gap-1 ${CLS[t]} ${key === selId ? 'ring-2 ring-slate-900 ring-offset-1 font-semibold' : ''} ${extra}`}>{content}</button>
  );
  const found = nodules.filter((n) => n.kind !== 'prior_not_found');
  const gone = nodules.filter((n) => n.kind === 'prior_not_found');
  const label = 'text-[11px] text-slate-500 whitespace-nowrap';
  const name = (n) => (n.match_to_prior && n.match_to_prior !== 'N/A' ? `${n.nodule_label} = ${priorTimepoint} ${n.match_to_prior}` : n.nodule_label);
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-white border-b border-slate-200">
      <span className={`${label} flex items-center gap-1`}>This scan: <Legend /></span>
      {found.map((n) => chip(n.id, name(n), tone(n), () => onSelect(n), n.nodule_label))}
      {central && chip(CENTRAL, 'Central', central.done ? 'accepted' : 'pending', () => onSelect({ id: CENTRAL }), 'Central areas')}
      {gone.length > 0 && <span className={`${label} ml-2`}>From Baseline:</span>}
      {gone.map((n) => chip(n.id, <><HelpCircle className="w-3.5 h-3.5 shrink-0" />Baseline {n.prior_label}: missing?</>,
        n.status !== 'Pending' ? 'accepted' : 'pending', () => onSelect(n), `Baseline ${n.prior_label}`, 'border-dashed'))}
      <button onClick={onList} className="ml-auto h-7 px-2 rounded text-xs text-slate-600 hover:bg-slate-100 flex items-center gap-1 whitespace-nowrap"><List className="w-3.5 h-3.5" />List view</button>
    </div>
  );
}