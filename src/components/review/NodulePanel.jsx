import { Plus, Check, X, ChevronRight, Lock } from 'lucide-react';
import NoduleList from '@/components/review/NoduleList';
import NoduleForm from '@/components/review/NoduleForm';
import PriorBox from '@/components/review/PriorBox';

const b = 'h-8 px-3 rounded-md text-sm flex items-center gap-1.5 disabled:opacity-40';

export default function NodulePanel(p) {
  const { scan, nodules, sel, onSelect, locked, isReviewer, onAdd, adding, formProps, prior, followup, canAccept, onAccept, onRejectClick, onNext, allDone, onApprove, onReopen } = p;
  const approved = scan.review_status === 'Approved';
  return (
    <aside className="w-[35%] min-w-[420px] border-l border-slate-200 bg-white flex flex-col min-h-0">
      <div className="h-10 flex items-center px-4 border-b border-slate-100">
        <span className="text-[11px] uppercase tracking-wider text-slate-500">Nodules <span className="font-mono">({nodules.length})</span></span>
        {!locked && <button onClick={onAdd} className={`ml-auto text-xs flex items-center gap-1 px-2 h-7 rounded ${adding ? 'bg-teal-600 text-white' : 'text-teal-700 hover:bg-teal-50'}`}><Plus className="w-3.5 h-3.5" />Add nodule</button>}
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-h-56 overflow-y-auto border-b border-slate-100"><NoduleList nodules={nodules} selId={sel?.id} onSelect={onSelect} /></div>
        {sel && (
          <div className="p-4 space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-lg font-semibold">{sel.nodule_label}</span>
              <span className="text-xs text-slate-500">{sel.source}{sel.status === 'Rejected' && sel.reject_reason ? ` · rejected: ${sel.reject_reason}` : ''}</span>
            </div>
            <NoduleForm n={sel} locked={locked} followup={followup} {...formProps} />
            {!locked && (
              <div className="flex gap-2">
                <button onClick={onAccept} disabled={!canAccept} title={followup && !sel.match_to_prior ? 'Choose Match to prior first' : 'A'} className={`${b} bg-emerald-600 text-white hover:bg-emerald-700`}><Check className="w-4 h-4" />Accept <kbd className="text-[10px] opacity-70">A</kbd></button>
                <button onClick={onRejectClick} className={`${b} border border-rose-200 text-rose-700 hover:bg-rose-50`}><X className="w-4 h-4" />Reject <kbd className="text-[10px] opacity-70">R</kbd></button>
                <button onClick={onNext} className={`${b} ml-auto border border-slate-200 hover:bg-slate-50`}>Next <kbd className="text-[10px] opacity-60">N</kbd><ChevronRight className="w-4 h-4" /></button>
              </div>
            )}
            {followup && <PriorBox {...prior} chosen={sel.match_to_prior} suggested={formProps.aiSuggest?.label} />}
          </div>
        )}
      </div>
      <div className="p-3 border-t border-slate-200 bg-slate-50">
        {approved ? (
          <div className="flex items-center gap-2 text-sm">
            <Lock className="w-4 h-4 text-emerald-700" />
            <span>Approved by <b className="font-mono">{scan.approved_by_initials}</b> · <span className="font-mono text-xs">{new Date(scan.approved_at).toLocaleString('en-GB')}</span> · <span className="font-mono">{scan.minutes_on_scan}</span> min</span>
            {isReviewer && <button onClick={onReopen} className="ml-auto h-8 px-3 rounded-md border border-slate-300 bg-white text-sm hover:bg-slate-100">Reopen</button>}
          </div>
        ) : isReviewer ? (
          <button onClick={onApprove} disabled={!allDone} className="w-full h-9 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40">
            {allDone ? 'Approve scan' : 'Approve scan (accept or reject every nodule first)'}
          </button>
        ) : <div className="text-xs text-slate-500 text-center">Read-only access</div>}
      </div>
    </aside>
  );
}