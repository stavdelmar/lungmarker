import { Plus, Check, X, ChevronRight, Lock, ScanSearch, CircleCheck, Circle, LogOut, ArrowLeft, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import NoduleList, { DoubtPills } from '@/components/review/NoduleList';
import { VolumeConfirm, Measurements, MatchToPrior, Notes } from '@/components/review/NoduleForm';
import PriorBox from '@/components/review/PriorBox';
import NotFoundCard from '@/components/review/NotFoundCard';
import StatusBadge from '@/components/StatusBadge';
import { uncertainty } from '@/lib/uncertainty';
import { CENTRAL } from '@/lib/reviewChecks';

const big = 'h-10 flex-1 rounded-md text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40';
const step = 'text-[10.5px] uppercase tracking-wider text-slate-400 font-medium';

// The central-areas item, shown where a nodule's fields normally are.
function CentralDetail({ central, locked, onAdd }) {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ScanSearch className={`w-5 h-5 ${central.done ? 'text-emerald-600' : 'text-amber-700'}`} />
        <span className="text-lg font-semibold">Central areas</span>
        <span className="text-xs text-slate-500">hilum / mediastinum</span>
      </div>
      <p className="text-[13px] text-slate-700 leading-snug">
        The AI misses tumours touching the hilum or mediastinum (all 7 of its misses in our test), so scroll through the central chest and add any it missed.
      </p>
      {central.done ? (
        <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm">
          <CircleCheck className="w-4 h-4 text-emerald-600" />
          <span>Checked by <b className="font-mono">{central.by}</b> · <span className="font-mono text-xs">{new Date(central.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span></span>
          {!locked && <button onClick={central.onUndo} className="ml-auto text-xs text-slate-500 underline hover:text-slate-800">Undo</button>}
        </div>
      ) : !locked && (
        <div className="flex gap-2">
          <button onClick={onAdd} className="h-10 px-3 rounded-md border border-slate-300 bg-white text-sm hover:bg-slate-50 flex items-center gap-1"><Plus className="w-4 h-4" />Add nodule</button>
          <button onClick={central.onCheck} className="h-10 flex-1 px-3 rounded-md bg-amber-500 text-amber-950 text-sm font-semibold hover:bg-amber-400 flex items-center justify-center gap-1.5">
            <Check className="w-4 h-4" />I checked the hilum and mediastinum
          </button>
        </div>
      )}
    </div>
  );
}

function NoduleDetail({ sel, locked, followup, canAccept, under4, onAccept, onRejectClick, onNext, formProps, prior }) {
  const u = uncertainty(sel);
  const blocked = !locked && !canAccept && (under4 || (followup && !sel.match_to_prior));
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-lg font-semibold">{sel.nodule_label}</span>
        <StatusBadge status={sel.status} />
        <span className="text-xs text-slate-500">{sel.source}{sel.status === 'Rejected' && sel.reject_reason ? ` · ${sel.reject_reason}` : ''}</span>
      </div>

      {/* 1 · decide */}
      {!locked && (
        <div>
          <div className="flex gap-2">
            <button onClick={onAccept} disabled={!canAccept} title={under4 ? 'Long axis under 4 mm: not measured (Reject → Under 4 mm)' : followup && !sel.match_to_prior ? 'Choose Match to prior first' : 'Accept (A)'}
              className={`${big} bg-emerald-600 text-white hover:bg-emerald-700 ${sel.status === 'Accepted' ? 'ring-2 ring-offset-1 ring-emerald-600' : ''}`}><Check className="w-4 h-4" />Accept <kbd className="text-[10px] opacity-70 font-normal">A</kbd></button>
            <button onClick={onRejectClick} className={`${big} border-2 border-rose-200 text-rose-700 hover:bg-rose-50 ${sel.status === 'Rejected' ? 'bg-rose-50 border-rose-300' : 'bg-white'}`}><X className="w-4 h-4" />Reject <kbd className="text-[10px] opacity-70 font-normal">R</kbd></button>
          </div>
          {blocked && <p className="text-[11.5px] text-amber-700 mt-1.5">{under4 ? 'Long axis is under 4 mm, so it is not measured. Reject it as "Under 4 mm", or correct the size.' : 'Choose Match to prior (below) before accepting.'}</p>}
        </div>
      )}

      {u.unsure && (
        <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3 space-y-1.5 text-[13px] text-amber-950">
          <div className="flex flex-wrap gap-1.5"><DoubtPills n={sel} size="lg" /></div>
          {u.lowConf && <p>The AI is less sure where this nodule's edge is. Check the outline before confirming it.</p>}
          {u.vessel && <p>It may be a vessel seen end-on. Scroll a few slices up and down: a vessel continues as a tube and branches, a nodule ends.</p>}
        </div>
      )}

      {followup && <MatchToPrior n={sel} locked={locked} priorLabels={formProps.priorLabels} aiSuggest={formProps.aiSuggest} onSave={formProps.onSave} />}

      {/* 2 · outline: tools are on the image toolbar. 3 · confirm it */}
      <div>
        <div className={`${step} mb-1`}>Outline · edit it on the image (Erase E · Draw D), then confirm</div>
        <VolumeConfirm n={sel} locked={locked} onSave={formProps.onSave} onConfirm={formProps.onConfirm} />
      </div>

      <div>
        <div className={`${step} mb-1`}>Measurements</div>
        <Measurements n={sel} locked={locked} onSave={formProps.onSave} />
      </div>
      <Notes n={sel} locked={locked} onSave={formProps.onSave} />
      <div className="flex">
        <button onClick={onNext} className="ml-auto h-8 px-3 rounded-md border border-slate-200 text-sm hover:bg-slate-50 flex items-center gap-1">Next <kbd className="text-[10px] opacity-60">N</kbd><ChevronRight className="w-4 h-4" /></button>
      </div>
      {followup && <PriorBox {...prior} chosen={sel.match_to_prior} suggested={formProps.aiSuggest?.label} />}
    </div>
  );
}

export default function NodulePanel(p) {
  const { scan, nodules, selId, sel, onSelect, locked, isReviewer, onAdd, adding, formProps, prior, followup, canAccept, under4, onAccept, onRejectClick, onNext,
    checks, onApprove, onReopen, central, notFound, next, waitForPrior, onSaveExit, unconfirmed = [] } = p;
  const approved = scan.review_status === 'Approved';
  const line = 'w-full flex items-center gap-2 text-sm rounded px-1.5 py-1 hover:bg-white text-left';
  return (
    <aside className="w-[35%] min-w-[420px] border-l border-slate-200 bg-white flex flex-col min-h-0">
      <div className="h-10 shrink-0 flex items-center px-4 border-b border-slate-100">
        <span className="text-[11px] uppercase tracking-wider text-slate-500">Nodules <span className="font-mono">({nodules.length})</span></span>
        {!locked && !waitForPrior && <button onClick={onAdd} className={`ml-auto text-xs flex items-center gap-1 px-2 h-7 rounded ${adding ? 'bg-teal-600 text-white' : 'text-teal-700 hover:bg-teal-50'}`}><Plus className="w-3.5 h-3.5" />Add nodule</button>}
      </div>
      <div className="flex-1 overflow-y-auto">
        {waitForPrior ? (
          <div className="m-4 rounded-lg border-2 border-amber-400 bg-amber-50 p-4 space-y-3 text-sm text-amber-950">
            <div className="font-semibold">The {waitForPrior.prior.timepoint} isn't approved yet</div>
            <p className="text-[13px]">Match to prior and the "not found in this scan?" checks use the prior scan's approved nodules. Review the {waitForPrior.prior.timepoint} ({waitForPrior.prior.scan_date?.slice(0, 10)}, series {waitForPrior.prior.series_number ?? '—'}) first.</p>
            <div className="flex gap-2">
              <button onClick={waitForPrior.open} className="h-9 px-3 rounded-md bg-teal-600 text-white hover:bg-teal-700 flex items-center gap-1">Open {waitForPrior.prior.timepoint}<ChevronRight className="w-4 h-4" /></button>
              <button onClick={waitForPrior.goOn} className="h-9 px-3 rounded-md border border-amber-300 bg-white hover:bg-amber-100">Review this one anyway</button>
            </div>
            <p className="text-[11.5px] text-amber-800">"Anyway" uses the AI's prior findings, not your approved ones. The timer starts once you begin.</p>
          </div>
        ) : (
          <>
            <div className="max-h-[42%] min-h-[96px] overflow-y-auto border-b border-slate-200"><NoduleList nodules={nodules} selId={selId} onSelect={onSelect} central={central} /></div>
            {selId === CENTRAL && <CentralDetail central={central} locked={locked} onAdd={onAdd} />}
            {sel && sel.kind === 'prior_not_found' && (
              <div className="p-4"><NotFoundCard n={sel} locked={locked} prior={prior} onConfirm={notFound.onConfirm} onHere={notFound.onHere} onReopen={notFound.onReopen} /></div>
            )}
            {sel && sel.kind !== 'prior_not_found' && (
              <NoduleDetail sel={sel} locked={locked} followup={followup} canAccept={canAccept} under4={under4} onAccept={onAccept} onRejectClick={onRejectClick} onNext={onNext} formProps={formProps} prior={prior} />
            )}
          </>
        )}
      </div>

      <div className="shrink-0 p-3 border-t border-slate-200 bg-slate-50">
        {approved ? (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-sm">
              <Lock className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Approved by <b className="font-mono">{scan.approved_by_initials}</b> · <span className="font-mono text-xs">{new Date(scan.approved_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</span> · <span className="font-mono">{scan.minutes_on_scan}</span> min{scan.active_minutes != null && <> (active <span className="font-mono">{scan.active_minutes}</span>)</>}</span>
              <Link to="/results" className="ml-auto text-xs text-teal-700 hover:underline whitespace-nowrap">Results →</Link>
              {isReviewer && <button onClick={onReopen} className="h-7 px-2.5 rounded-md border border-slate-300 bg-white text-xs hover:bg-slate-100">Reopen</button>}
            </div>
            {isReviewer && next && (
              <div className="grid grid-cols-2 gap-2">
                {next.scan ? (
                  <button onClick={() => next.open(next.scan)} className="h-10 rounded-md bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 flex items-center justify-center gap-1">Next scan for this patient<ChevronRight className="w-4 h-4" /></button>
                ) : next.patient ? (
                  <button onClick={() => next.open(next.patient.scan)} className="h-10 rounded-md bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 flex items-center justify-center gap-1">Next patient · <span className="font-mono">{next.patient.patient_id}</span><ChevronRight className="w-4 h-4" /></button>
                ) : (
                  <div className="h-10 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-center gap-1.5"><CircleCheck className="w-4 h-4" />Worklist done</div>
                )}
                <button onClick={next.done} className="h-10 rounded-md border border-slate-300 bg-white text-sm font-medium hover:bg-slate-100 flex items-center justify-center gap-1"><ArrowLeft className="w-4 h-4" />Done, back to worklist</button>
              </div>
            )}
            {isReviewer && next && !next.scan && <div className="text-xs text-slate-500">All scans of <span className="font-mono">{scan.patient_id}</span> approved.</div>}
          </div>
        ) : isReviewer && !waitForPrior ? (
          <div className="space-y-1.5">
            <div className="flex items-center">
              <span className="text-[11px] uppercase tracking-wider text-slate-500">Before approving</span>
              <button onClick={onSaveExit} className="ml-auto h-7 px-2.5 rounded-md border border-slate-300 bg-white text-xs hover:bg-slate-100 flex items-center gap-1" title="Stops the timer, keeps everything, Continue brings you back here"><LogOut className="w-3.5 h-3.5" />Save &amp; exit</button>
            </div>
            <button className={line} onClick={() => checks.firstOpen && onSelect(checks.firstOpen)}>
              {checks.nodulesOk ? <CircleCheck className="w-4 h-4 text-emerald-600 shrink-0" /> : <Circle className="w-4 h-4 text-slate-300 shrink-0" />}
              <span className="text-slate-800">Every nodule decided</span>
              <span className={`ml-auto text-xs ${checks.nodulesOk ? 'text-slate-500 font-mono' : 'text-amber-700'}`}>{checks.nodulesOk ? `${checks.decided}/${checks.total}` : `${checks.why} →`}</span>
            </button>
            <button className={line} onClick={() => onSelect({ id: CENTRAL })}>
              {central.done ? <CircleCheck className="w-4 h-4 text-emerald-600 shrink-0" /> : <Circle className="w-4 h-4 text-slate-300 shrink-0" />}
              <span className="text-slate-800">Central areas checked</span>
              <span className={`ml-auto text-xs ${central.done ? 'text-slate-500 font-mono' : 'text-amber-700'}`}>{central.done ? central.by : 'not checked →'}</span>
            </button>
            {/* Soft reminder, never blocks: Daniel's rule records a volume only for a confirmed outline. */}
            {unconfirmed.length > 0 && (
              <div className="flex items-start gap-2 rounded-md bg-sky-50 border border-sky-200 px-2.5 py-1.5 text-[12px] text-sky-950">
                <Info className="w-4 h-4 text-sky-700 shrink-0 mt-px" />
                <span className="flex-1">
                  {unconfirmed.length === 1 ? <><b className="font-mono">{unconfirmed[0].nodule_label}</b> has</> : <><b className="font-mono">{unconfirmed.map((n) => n.nodule_label).join(', ')}</b> have</>} no confirmed outline, so no volume will be recorded{unconfirmed.length === 1 ? ' for it' : ''}. You can still approve.
                </span>
                <button onClick={() => onSelect(unconfirmed[0])} className="shrink-0 text-sky-800 font-medium hover:underline whitespace-nowrap">Go to {unconfirmed[0].nodule_label} →</button>
              </div>
            )}
            <button onClick={onApprove} disabled={!checks.ok} className="mt-1 w-full h-10 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40">
              {checks.ok ? 'Approve scan' : 'Approve scan (finish both steps first)'}
            </button>
          </div>
        ) : waitForPrior ? null : <div className="text-xs text-slate-500 text-center">Read-only access</div>}
      </div>
    </aside>
  );
}
