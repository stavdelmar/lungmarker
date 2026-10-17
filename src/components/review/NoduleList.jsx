import { AlertTriangle, GitBranch, HelpCircle, ScanSearch, CircleCheck } from 'lucide-react';
import { CENTRAL } from '@/lib/reviewChecks';
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
        <span className={`inline-flex items-center gap-1 rounded font-semibold bg-amber-400 text-amber-950 whitespace-nowrap ${cls}`}>
          <AlertTriangle className="w-3.5 h-3.5" />AI unsure about the edges{u.pct != null && <span className="font-mono font-normal">· {u.pct}%</span>}
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
        ${n.id === sel ? 'border-l-teal-600' : u.unsure ? 'border-l-amber-400' : nf && n.status === 'Pending' ? 'border-l-amber-300' : 'border-l-transparent'}
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

// Last item of the list: the required check of the central areas (the AI's known blind spot).
function CentralRow({ central, sel, onSelect }) {
  const on = sel === CENTRAL;
  return (
    <button onClick={() => onSelect({ id: CENTRAL })}
      className={`w-full text-left pl-3 pr-4 py-2.5 flex items-center gap-3 border-l-4 border-t border-t-slate-200 ${on ? 'border-l-teal-600' : central.done ? 'border-l-transparent' : 'border-l-amber-400'} ${on ? 'bg-teal-50/70' : central.done ? 'hover:bg-slate-50' : 'bg-amber-50/60 hover:bg-amber-50'}`}>
      {central.done ? <CircleCheck className="w-4 h-4 text-emerald-600 shrink-0" /> : <ScanSearch className="w-4 h-4 text-amber-700 shrink-0" />}
      <span className={`flex-1 text-sm ${on ? 'font-semibold text-teal-900' : 'text-slate-800'}`}>Central areas <span className="text-slate-500 font-normal">(hilum / mediastinum)</span></span>
      {central.done
        ? <span className="text-xs text-emerald-700">Checked · <span className="font-mono">{central.by}</span></span>
        : <span className="text-xs font-medium text-amber-800">Not checked</span>}
    </button>
  );
}

export default function NoduleList({ nodules, selId, onSelect, central }) {
  const centralRow = central && <CentralRow central={central} sel={selId} onSelect={onSelect} />;
  if (!nodules.length) return <div><div className="px-4 py-4 text-xs text-slate-500">The AI found no nodules on this scan. Check the central areas carefully.</div>{centralRow}</div>;
  const found = nodules.filter((n) => n.kind !== 'prior_not_found');
  const gone = nodules.filter((n) => n.kind === 'prior_not_found');
  const unsure = found.filter((n) => uncertainty(n).unsure).length;
  return (
    <div>
      {unsure > 0 && (
        <div className="px-4 py-1.5 text-xs bg-amber-100 text-amber-950 border-b border-amber-200 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /><b>{unsure}</b> of {found.length} finding{found.length === 1 ? '' : 's'}: the AI is unsure about the edges. Check those outlines closely.
        </div>
      )}
      <div className="divide-y divide-slate-100">{found.map((n) => <Row key={n.id} n={n} sel={selId} onSelect={onSelect} />)}</div>
      {gone.length > 0 && (
        <>
          <div className="px-4 pt-2.5 pb-1 text-[11px] uppercase tracking-wider text-slate-500 border-t border-slate-200">From the prior scan · not found here?</div>
          <div className="divide-y divide-slate-100">{gone.map((n) => <Row key={n.id} n={n} sel={selId} onSelect={onSelect} />)}</div>
        </>
      )}
      {centralRow}
    </div>
  );
}