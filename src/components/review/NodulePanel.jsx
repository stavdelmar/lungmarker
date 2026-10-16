import { Plus, Check, X, ChevronRight, Lock, ScanSearch, CircleCheck, Circle } from 'lucide-react';
import { Link } from 'react-router-dom';
import NoduleList from '@/components/review/NoduleList';
import NoduleForm from '@/components/review/NoduleForm';
import PriorBox from '@/components/review/PriorBox';
import NotFoundCard from '@/components/review/NotFoundCard';
import { DoubtPills } from '@/components/review/NoduleList';
import { uncertainty } from '@/lib/uncertainty';

const b = 'h-8 px-3 rounded-md text-sm flex items-center gap-1.5 disabled:opacity-40';

export default function NodulePanel(p) {
  const { scan, nodules, sel, onSelect, locked, isReviewer, onAdd, adding, formProps, prior, followup, canAccept, under4, onAccept, onRejectClick, onNext, allDone, onApprove, onReopen, central, notFound } = p;
  const decided = nodules.filter((n) => n.status === 'Accepted' || n.status === 'Rejected').length;
  const approved = scan.review_status === 'Approved';
  return (
    <aside className="w-[35%] min-w-[420px] border-l border-slate-200 bg-white flex flex-col min-h-0">
      <div className="h-10 flex items-center px-4 border-b border-slate-100">
        <span className="text-[11px] uppercase tracking-wider text-slate-500">Nodules <span className="font-mono">({nodules.length})</span></span>
        {!locked && <button onClick={onAdd} className={`ml-auto text-xs flex items-center gap-1 px-2 h-7 rounded ${adding ? 'bg-teal-600 text-white' : 'text-teal-700 hover:bg-teal-50'}`}><Plus className="w-3.5 h-3.5" />Add nodule</button>}
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-h-56 overflow-y-auto border-b border-slate-100"><NoduleList nodules={nodules} selId={sel?.id} onSelect={onSelect} /></div>
        {sel && sel.kind === 'prior_not_found' && (
          <div className="p-4"><NotFoundCard n={sel} locked={locked} prior={prior} onConfirm={notFound.onConfirm} onHere={notFound.onHere} onReopen={notFound.onReopen} /></div>
        )}
        {sel && sel.kind !== 'prior_not_found' && (
          <div className="p-4 space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-lg font-semibold">{sel.nodule_label}</span>
              <span className="text-xs text-slate-500">{sel.source}{sel.status === 'Rejected' && sel.reject_reason ? ` · rejected: ${sel.reject_reason}` : ''}</span>
            </div>
            {uncertainty(sel).unsure && (
              <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3 space-y-1.5 text-[13px] text-amber-950">
                <div className="flex flex-wrap gap-1.5"><DoubtPills n={sel} size="lg" /></div>
                {uncertainty(sel).lowConf && <p>The AI is not sure this is a nodule{uncertainty(sel).pct != null ? ` (confidence ${uncertainty(sel).pct}%)` : ''}. Check it before accepting.</p>}
                {uncertainty(sel).vessel && <p>It may be a vessel seen end-on. Scroll a few slices up and down: a vessel continues as a tube and branches, a nodule ends.</p>}
              </div>
            )}
            <NoduleForm n={sel} locked={locked} followup={followup} {...formProps} />
            {!locked && (
              <div className="flex gap-2">
                <button onClick={onAccept} disabled={!canAccept} title={under4 ? 'Long axis under 4 mm – not measured (Reject → Under 4 mm)' : followup && !sel.match_to_prior ? 'Choose Match to prior first' : 'A'} className={`${b} bg-emerald-600 text-white hover:bg-emerald-700`}><Check className="w-4 h-4" />Accept <kbd className="text-[10px] opacity-70">A</kbd></button>
                <button onClick={onRejectClick} className={`${b} border border-rose-200 text-rose-700 hover:bg-rose-50`}><X className="w-4 h-4" />Reject <kbd className="text-[10px] opacity-70">R</kbd></button>
                <button onClick={onNext} className={`${b} ml-auto border border-slate-200 hover:bg-slate-50`}>Next <kbd className="text-[10px] opacity-60">N</kbd><ChevronRight className="w-4 h-4" /></button>
              </div>
            )}
            {!locked && !canAccept && (under4 || (followup && !sel.match_to_prior)) && (
              <p className="text-[11.5px] text-amber-700 -mt-2">{under4 ? 'Long axis is under 4 mm, so it is not measured. Reject it with reason "Under 4 mm", or correct the size.' : 'Choose Match to prior (or N/A) before accepting.'}</p>
            )}
            {followup && <PriorBox {...prior} chosen={sel.match_to_prior} suggested={formProps.aiSuggest?.label} />}
          </div>
        )}
      </div>
      <div className="p-3 border-t border-slate-200 bg-slate-50">
        {approved ? (
          <div className="flex items-center gap-2 text-sm">
            <Lock className="w-4 h-4 text-emerald-700" />
            <span>Saved · approved by <b className="font-mono">{scan.approved_by_initials}</b> · <span className="font-mono text-xs">{new Date(scan.approved_at).toLocaleString('en-GB')}</span> · <span className="font-mono">{scan.minutes_on_scan}</span> min{scan.active_minutes != null && <> (active <span className="font-mono">{scan.active_minutes}</span>)</>}{scan.central_checked_by_initials && <> · central areas checked</>}</span>
            <Link to="/results" className="ml-auto text-teal-700 hover:underline whitespace-nowrap">See in Results →</Link>
            {isReviewer && <button onClick={onReopen} className="h-8 px-3 rounded-md border border-slate-300 bg-white text-sm hover:bg-slate-100">Reopen</button>}
          </div>
        ) : isReviewer ? (
          <div className="space-y-2.5">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">Before approving</div>
            {/* Step 1: every nodule decided */}
            <div className="flex items-center gap-2 text-sm">
              {allDone ? <CircleCheck className="w-5 h-5 text-emerald-600 shrink-0" /> : <Circle className="w-5 h-5 text-slate-300 shrink-0" />}
              <span className={allDone ? 'text-slate-700' : 'text-slate-900'}>Every nodule decided{nodules.some((n) => n.kind === 'prior_not_found') ? ' (incl. prior nodules not found)' : ''}</span>
              <span className="ml-auto font-mono text-xs text-slate-500">{decided}/{nodules.length}</span>
            </div>
            {/* Step 2: central areas — required, the AI's known blind spot */}
            {central?.done ? (
              <div className="flex items-center gap-2 text-sm">
                <CircleCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="text-slate-700">Central areas checked (hilum / mediastinum)</span>
                <span className="ml-auto font-mono text-xs text-slate-500">{central.by} · {new Date(central.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                <button onClick={central.onUndo} className="text-xs text-slate-500 underline hover:text-slate-800">Undo</button>
              </div>
            ) : (
              <div role="group" aria-label="Central areas check" className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3">
                <div className="flex items-start gap-2.5">
                  <ScanSearch className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-semibold text-amber-950">Check the central areas: hilum and mediastinum</div>
                    <p className="text-[13px] text-amber-900 mt-1 leading-snug">
                      The AI misses tumours that touch the hilum or mediastinum, even large ones. In our test it missed 7 of 59 tumours, and all 7 were central.
                      {nodules.length === 0 && <b> The AI found no nodules on this scan, so check carefully.</b>}
                    </p>
                    <p className="text-[13px] text-amber-900 mt-1">Scroll through the central chest{central?.onMediastinal ? ' in the mediastinal window' : ''}. If you find a tumour, add it with <b>Add nodule</b>.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {central?.onMediastinal && central.win !== 'mediastinal' && (
                    <button onClick={central.onMediastinal} className="h-9 px-3 rounded-md border border-amber-400 bg-white text-sm text-amber-950 hover:bg-amber-100">Switch to mediastinal window</button>
                  )}
                  <button onClick={onAdd} className="h-9 px-3 rounded-md border border-amber-400 bg-white text-sm text-amber-950 hover:bg-amber-100 flex items-center gap-1"><Plus className="w-4 h-4" />Add nodule</button>
                  <button onClick={central?.onCheck} className="h-9 px-4 rounded-md bg-amber-500 text-amber-950 text-sm font-semibold hover:bg-amber-400 flex items-center gap-1.5 ml-auto">
                    <Check className="w-4 h-4" />I checked the hilum and mediastinum
                  </button>
                </div>
              </div>
            )}
            <button onClick={onApprove} disabled={!allDone || !central?.done} className="w-full h-10 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40">
              {allDone && central?.done ? 'Approve scan' : 'Approve scan (finish the steps above first)'}
            </button>
          </div>
        ) : <div className="text-xs text-slate-500 text-center">Read-only access</div>}
      </div>
    </aside>
  );
}