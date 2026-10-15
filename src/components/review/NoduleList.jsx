import { AlertTriangle } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { fmtMaybe } from '@/components/review/viewerUtils';

export default function NoduleList({ nodules, selId, onSelect }) {
  if (!nodules.length) return <div className="px-4 py-6 text-xs text-slate-400">No nodules on this scan.</div>;
  return (
    <div className="divide-y divide-slate-100">
      {nodules.map((n) => (
        <button key={n.id} onClick={() => onSelect(n)}
          className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors ${n.id === selId ? 'bg-teal-50/70' : 'hover:bg-slate-50'}`}>
          <span className={`font-mono text-sm w-8 ${n.id === selId ? 'text-teal-800 font-semibold' : ''}`}>{n.nodule_label}</span>
          <span className="text-xs text-slate-500 w-9">{n.lobe || '—'}</span>
          <span className="font-mono text-xs w-24">{fmtMaybe(n.long_axis_mm)} × {fmtMaybe(n.short_axis_mm)}</span>
          <span className="flex-1 flex flex-wrap gap-1">
            {(n.flags || []).map((f) => (
              <span key={f} className="inline-flex items-center gap-0.5 text-[10.5px] text-amber-700"><AlertTriangle className="w-3 h-3" />{f}</span>
            ))}
            {n.source === 'Added by reviewer' && <span className="text-[10.5px] text-slate-500">added</span>}
          </span>
          {n.was_edited && <StatusBadge status="Edited" />}
          <StatusBadge status={n.status} />
        </button>
      ))}
    </div>
  );
}