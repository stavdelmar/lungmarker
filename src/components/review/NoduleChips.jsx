import { List } from 'lucide-react';
import { CENTRAL } from '@/lib/reviewChecks';
import { uncertainty } from '@/lib/uncertainty';

const tone = (decided, unsure) => (decided ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : unsure ? 'bg-amber-100 text-amber-900 border-amber-400' : 'bg-slate-100 text-slate-700 border-slate-300');

// Compact nodule picker: grey pending, green decided, amber AI unsure.
export default function NoduleChips({ nodules, selId, onSelect, central, onList }) {
  const chip = (key, label, cls, on, click) => (
    <button key={key} onClick={click} className={`h-7 px-2.5 rounded-full border text-xs font-mono whitespace-nowrap ${cls} ${on ? 'ring-2 ring-teal-600 ring-offset-1' : ''}`}>{label}</button>
  );
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-white border-b border-slate-200">
      {nodules.map((n) => chip(n.id, n.kind === 'prior_not_found' ? `Prior ${n.prior_label}?` : n.nodule_label,
        tone(n.status !== 'Pending', uncertainty(n).unsure), n.id === selId, () => onSelect(n)))}
      {central && chip(CENTRAL, 'Central', tone(central.done, true), selId === CENTRAL, () => onSelect({ id: CENTRAL }))}
      <button onClick={onList} className="ml-auto h-7 px-2 rounded text-xs text-slate-600 hover:bg-slate-100 flex items-center gap-1"><List className="w-3.5 h-3.5" />List view</button>
    </div>
  );
}