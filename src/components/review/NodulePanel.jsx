import { Plus, Check, ChevronRight, Lock, ScanSearch, CircleCheck, LogOut, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import NoduleChips from '@/components/review/NoduleChips';
import NoduleList from '@/components/review/NoduleList';
import NoduleSteps from '@/components/review/NoduleSteps';
import NoduleHeader from '@/components/review/NoduleHeader';
import NotFoundCard from '@/components/review/NotFoundCard';
import { CENTRAL } from '@/lib/reviewChecks';

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
            <Check className="w-4 h-4 shrink-0" />Mark checked
          </button>
        </div>
      )}
    </div>
  );
}


// Clickable inline text for the summary line: wraps like normal text (a <button> is always inline-block, so a long
// reason inside it gets cut off instead of wrapping). Keyboard: Enter / Space.
function InlineLink({ onClick, className = '', title, children }) {
  return (
    <span role="button" tabIndex={0} title={title} onClick={onClick} className={`cursor-pointer ${className}`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}>{children}</span>
  );
}

export default function NodulePanel(p) {
  const { scan, nodules, selId, sel, onSelect, locked, isReviewer, onAdd, adding, formProps, prior, followup, canAccept, under4, onAccept, onRejectClick, onNext, onReject, onOpenPrior,
    checks, onApprove, onReopen, central, notFound, next, waitForPrior, onSaveExit, unconfirmed = [], onAccountPrior, matchChecks = [] } = p;
  const approved = scan.review_status === 'Approved';
  const [listView, setListView] = useState(false);
  return (
    <aside className="nodule-panel w-[35%] min-w-[420px] border-l border-slate-200 bg-slate-50 flex flex-col min-h-0">
      <div className="h-10 shrink-0 flex items-center px-4 border-b border-slate-200 bg-white">
        <span className="text-[11px] uppercase tracking-wider text-slate-500">Nodules <span className="font-mono">({nodules.length})</span></span>
        {!locked && !waitForPrior && <button onClick={onAdd} className={`ml-auto text-xs flex items-center gap-1 px-2 h-7 rounded ${adding ? 'bg-teal-600 text-white' : 'text-teal-700 hover:bg-teal-50'}`}><Plus className="w-3.5 h-3.5" />Add nodule</button>}
      </div>
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
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
            {(sel || selId === CENTRAL) && !listView ? (
              <NoduleChips nodules={nodules} selId={selId} onSelect={onSelect} central={central} onList={() => setListView(true)} />
            ) : (
              <div className="shrink-0 bg-white border-b border-slate-200">
                {(sel || selId === CENTRAL) && <button onClick={() => setListView(false)} className="w-full px-3 py-1 text-xs text-teal-700 hover:bg-teal-50 text-right">Compact view</button>}
                <NoduleList nodules={nodules} selId={selId} onSelect={onSelect} central={central} />
              </div>
            )}
            <div className="m-3 rounded-lg border border-slate-200 bg-white shadow-sm">
              {sel && <NoduleHeader sel={sel} nodules={nodules} onSelect={onSelect} />}
              <div>
                {!sel && selId !== CENTRAL && <div className="p-4 text-sm text-slate-500">Select a nodule in the list.</div>}
                {selId === CENTRAL && <CentralDetail central={central} locked={locked} onAdd={onAdd} />}
                {sel && sel.kind === 'prior_not_found' && (
                  <div className="p-4"><NotFoundCard n={sel} locked={locked} prior={prior} onConfirm={notFound.onConfirm} onHere={notFound.onHere} onReopen={notFound.onReopen} /></div>
                )}
                {sel && sel.kind !== 'prior_not_found' && (
                  <NoduleSteps key={sel.id} sel={sel} nodules={nodules} locked={locked} followup={followup} canAccept={canAccept} under4={under4} onAccept={onAccept}
                    onReject={onReject} onRejectClick={onRejectClick} onNext={onNext} formProps={formProps} prior={prior} onOpenPrior={onOpenPrior} />
                )}
              </div>
            </div>
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
                  <button onClick={() => next.open(next.patient.scan)} className="h-10 rounded-md bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 flex items-center justify-center gap-1">Next patient<ChevronRight className="w-4 h-4" /></button>
                ) : (
                  <div className="h-10 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-center gap-1.5"><CircleCheck className="w-4 h-4" />Worklist done</div>
                )}
                <button onClick={next.done} className="h-10 rounded-md border border-slate-300 bg-white text-sm font-medium hover:bg-slate-100 flex items-center justify-center gap-1"><ArrowLeft className="w-4 h-4" />Done, back to worklist</button>
              </div>
            )}
            {isReviewer && next && !next.scan && <div className="text-xs text-slate-500">All scans of <span className="font-mono">{scan.patient_id}</span> approved.</div>}
          </div>
        ) : isReviewer && !waitForPrior ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="flex-1 min-w-0 leading-snug break-words">{/* wraps, never truncates: every reason stays visible */}
              {checks.ok ? <span className="text-emerald-700">All decided · central checked</span> : <>
                {/* every reason at once ("1 not decided yet · N3: no lobe · prior N1 not matched or confirmed not found"); click → first open item */}
                {!checks.nodulesOk && <InlineLink className="text-amber-700 hover:underline" title={checks.why}
                  onClick={() => (checks.firstOpen ? onSelect(checks.firstOpen) : checks.unaccounted?.[0] && onAccountPrior?.(checks.unaccounted[0]))}>{checks.why}</InlineLink>}
                {!checks.nodulesOk && !central.done && ' · '}
                {!central.done && <InlineLink className="whitespace-nowrap text-amber-700 hover:underline" onClick={() => onSelect({ id: CENTRAL })}>central not checked</InlineLink>}
              </>}
              {matchChecks.length > 0 && <>{' · '}<InlineLink className="whitespace-nowrap text-amber-700 hover:underline" title="A match looks implausible (lobe, size or position). Only a hint, you can still approve." onClick={() => onSelect(matchChecks[0])}>{matchChecks.length} match{matchChecks.length === 1 ? '' : 'es'} to check</InlineLink></>}
              {unconfirmed.length > 0 && <>{' · '}<InlineLink className="whitespace-nowrap text-sky-700 hover:underline" title="No volume will be recorded for these. You can still approve." onClick={() => onSelect(unconfirmed[0])}>{unconfirmed.length} outline{unconfirmed.length === 1 ? '' : 's'} unconfirmed</InlineLink></>}
            </span>
            <button onClick={onSaveExit} className="shrink-0 whitespace-nowrap h-8 px-2.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 flex items-center gap-1" title="Stops the timer, keeps everything, Continue brings you back here"><LogOut className="w-3.5 h-3.5" />Save &amp; exit</button>
            <button onClick={onApprove} disabled={!checks.ok} className="shrink-0 whitespace-nowrap h-8 px-3 rounded-md bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:opacity-40">Approve →</button>
          </div>
        ) : waitForPrior ? null : <div className="text-xs text-slate-500 text-center">Read-only access</div>}
      </div>
    </aside>
  );
}