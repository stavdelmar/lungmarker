import { AlertTriangle, GitBranch, HelpCircle } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { fmtMaybe } from '@/components/review/viewerUtils';
import { uncertainty, FLAG_TEXT } from '@/lib/uncertainty';

// Pills for the AI's doubts: big and coloured, so Daniel sees at a glance which findings need a closer look.
export function DoubtPills({ n, size = 'sm' }) {
  const u = uncertainty(n);
  const cls = size === 'lg' ? 'text-xs px-2 py-1' : 'text-[11px] px-1.5 py-0.5';
  return (
    <>
      {u.lowConf && (
        <span className={`inline-flex items-center gap-1 rounded font-semibold bg-amber-400 text-amber-950 ${cls}`}>
          <AlertTriangle className="w-3.5 h-3.5" />AI unsure{u.pct != null && <span className="font-mono font-normal">· {u.pct}%</span>}
        </span>
      )}
      {u.vessel && (
        <span className={`inline-flex items-center gap-1 rounded font-semibold bg-orange-500 text-white ${cls}`}>
          <GitBranch className="w-3.5 h-3.5" />Possibly a vessel
        </span>
      )}
    </>
  );
}

function Row({ n, sel, onSelect }) {
  const u = uncertainty(n);
  const nf = n.kind === 'prior_not_found';
  const otherFlags = (n.flags || []).filter((f) => FLAG_TEXT[f]);
  return (
    <button onClick={() => onSelect(n)}
      className={`w-full text-left pl-3 pr-4 py-2 flex items-center gap-3 border-l-4 transition-colors
        ${u.unsure ? 'border-l-amber-400' : nf && n.status === 'Pending' ? 'border-l-amber-300' : 'border-l-transparent'}
        ${n.id === sel ? 'bg-teal-50/70' : u.unsure ? 'bg-amber-50/60 hover:bg-amber-50' : 'hover:bg-slate-50'}`}>
      <span className={`font-mono text-sm w-8 shrink-0 ${n.id === sel ? 'text-teal-800 font-semibold' : ''}`}>{nf ? n.prior_label : n.nodule_label}</span>
      <span className="text-xs text-slate-500 w-9 shrink-0">{n.lobe || '—'}</span>
      {nf ? (
        <span className="flex-1 inline-flex items-center gap-1 text-xs text-slate-700"><HelpCircle className="w-3.5 h-3.5 text-amber-600" />Not found in this scan?</span>
      ) : (
        <>
          <span className="font-mono text-xs w-24 shrink-0">{fmtMaybe(n.long_axis_mm)} × {fmtMaybe(n.short_axis_mm)}</span>
          <span className="flex-1 flex flex-wrap items-center gap-1">
            <DoubtPills n={n} />
            {otherFlags.map((f) => <span key={f} className="text-[10.5px] text-slate-500">{FLAG_TEXT[f]}</span>)}
            {n.source === 'Added by reviewer' && <span className="text-[10.5px] text-slate-500">added by you</span>}
          </span>
        </>
      )}
      {n.was_edited && <StatusBadge status="Edited" />}
      <StatusBadge status={nf && n.status === 'Accepted' ? 'Not found' : n.status} />
    </button>
  );
}

export default function NoduleList({ nodules, selId, onSelect }) {
  if (!nodules.length) return <div className="px-4 py-6 text-xs text-slate-400">No nodules on this scan.</div>;
  const found = nodules.filter((n) => n.kind !== 'prior_not_found');
  const gone = nodules.filter((n) => n.kind === 'prior_not_found');
  const unsure = found.filter((n) => uncertainty(n).unsure).length;
  return (
    <div>
      {unsure > 0 && (
        <div className="px-4 py-1.5 text-xs bg-amber-100 text-amber-950 border-b border-amber-200 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /><b>{unsure}</b> of {found.length} finding{found.length === 1 ? '' : 's'} the AI is unsure about. Look at these closely.
        </div>
      )}
      <div className="divide-y divide-slate-100">{found.map((n) => <Row key={n.id} n={n} sel={selId} onSelect={onSelect} />)}</div>
      {gone.length > 0 && (
        <>
          <div className="px-4 pt-2.5 pb-1 text-[11px] uppercase tracking-wider text-slate-500 border-t border-slate-200">From the prior scan · not found here?</div>
          <div className="divide-y divide-slate-100">{gone.map((n) => <Row key={n.id} n={n} sel={selId} onSelect={onSelect} />)}</div>
        </>
      )}
    </div>
  );
}
