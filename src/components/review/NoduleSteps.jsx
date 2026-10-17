import { useState } from 'react';
import { Check, X, ChevronRight } from 'lucide-react';
import Step from '@/components/review/Step';
import MatchCompare from '@/components/review/MatchCompare';
import { matchWarnings } from '@/lib/matchChecks';
import { DoubtPills } from '@/components/review/NoduleList';
import { VolumeConfirm, Measurements, Notes } from '@/components/review/NoduleForm';
import { fmtMaybe } from '@/components/review/viewerUtils';
import { uncertainty } from '@/lib/uncertainty';

const quick = 'h-8 min-w-16 px-3 rounded-md border border-rose-200 bg-white text-rose-700 text-xs hover:bg-rose-50 whitespace-nowrap';
const big = 'h-9 flex-1 min-w-24 px-3 rounded-md text-sm font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap';

// Daniel's order: 1 is it a nodule · 2 outline & measurements · 3 match to prior (follow-ups) · 4 notes & accept.
// Keyed by nodule in the panel, so the local "continue" flags are per nodule.
export default function NoduleSteps({ sel, nodules, locked, followup, canAccept, under4, onAccept, onReject, onRejectClick, onNext, formProps, prior, onOpenPrior }) {
  const [isNodule, setIsNodule] = useState(false);
  const [measOk, setMeasOk] = useState(false);
  const [openStep, setOpenStep] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const u = uncertainty(sel);
  const rejected = sel.status === 'Rejected', accepted = sel.status === 'Accepted';
  const done = [sel.status !== 'Pending' || isNodule, accepted || measOk, !followup || !!sel.match_to_prior, accepted];
  const first = rejected ? 0 : done.findIndex((d) => !d) + 1;
  const cur = openStep ?? first;
  const state = (i) => (i === 3 && !followup ? 'skipped' : done[i - 1] ? 'done' : i === first ? 'current' : 'todo');
  const toggle = (i) => setOpenStep(cur === i ? 0 : i);
  const advance = (fn) => { fn(); setOpenStep(null); };
  const matchCheck = matchWarnings(sel, sel.match_to_prior, prior?.priorNodules || [], nodules).length > 0;
  const match = sel.match_to_prior === 'N/A' ? 'New nodule' : sel.match_to_prior ? `Same as prior ${sel.match_to_prior}${matchCheck ? ' · ⚠ check' : ''}` : '';
  const sp = { locked, onSave: (patch) => { setOpenStep(null); return formProps.onSave(patch); } };
  return (
    <div className="p-4">
      <Step n={1} title="Is it a nodule?" state={state(1)} open={cur === 1} onToggle={() => toggle(1)} summary={rejected ? `Rejected: ${sel.reject_reason}` : done[0] ? 'Yes' : ''}>
        <p className="text-[13px] text-slate-600">Scroll up and down: a vessel continues as a tube, a nodule ends.</p>
        {!locked && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <button onClick={() => advance(() => setIsNodule(true))} className={`${big} bg-slate-900 text-white hover:bg-slate-800`}><Check className="w-4 h-4 shrink-0" />Yes</button>
              <button onClick={() => setRejecting((r) => !r)} className={`${big} border-2 border-rose-200 bg-white text-rose-700 hover:bg-rose-50`}><X className="w-4 h-4 shrink-0" />Reject</button>
            </div>
            {rejecting && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">Why?
                <button className={quick} onClick={() => onReject('Vessel')}>Vessel</button>
                <button className={quick} onClick={() => onReject('Scar/artefact')}>Scar</button>
                <button className={quick} onClick={onRejectClick}>Other…</button>
              </div>
            )}
          </div>
        )}
      </Step>
      <Step n={2} title="Outline & measurements" state={state(2)} open={cur === 2} onToggle={() => toggle(2)}
        summary={`${fmtMaybe(sel.long_axis_mm)} × ${fmtMaybe(sel.short_axis_mm)} mm · vol ${sel.volume_mm3 == null ? '—' : Math.round(sel.volume_mm3)} mm³${sel.outline_confirmed ? ' · confirmed' : ''}`}>
        {u.unsure && (
          <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3 space-y-1.5 text-[13px] text-amber-950">
            <div className="flex flex-wrap gap-1.5"><DoubtPills n={sel} size="lg" /></div>
            {u.faintRim && <p className="font-semibold">AI unsure about the edges: may be larger than drawn</p>}
            {u.lowConf && <p>The AI is less sure where this nodule's edge is. Check the outline before confirming it.</p>}
            {u.vessel && <p>It may be a vessel seen end-on. Scroll a few slices up and down: a vessel continues as a tube and branches, a nodule ends.</p>}
          </div>
        )}
        <p className="text-[11.5px] text-slate-500">Edit the outline on the image (Erase E · Draw D), then confirm it.</p>
        {formProps.span && <p className="text-[11.5px] text-slate-500">Check the first and last slices (↑ ↓ on the image): small end slices affect the volume.</p>}
        <VolumeConfirm n={sel} locked={locked} onSave={formProps.onSave} onConfirm={formProps.onConfirm} />
        <Measurements n={sel} locked={locked} onSave={formProps.onSave} />
        {!locked && !accepted && <button onClick={() => advance(() => setMeasOk(true))} className="h-8 min-w-24 px-3 rounded-md bg-slate-900 text-white text-sm hover:bg-slate-800 flex items-center justify-center gap-1 whitespace-nowrap">Continue<ChevronRight className="w-4 h-4" /></button>}
      </Step>
      <Step n={3} title="Match to prior" state={state(3)} open={followup && cur === 3} onToggle={() => followup && toggle(3)} summary={followup ? match : 'Skipped on baseline'}>
        <MatchCompare sel={sel} nodules={nodules} prior={prior} aiSuggest={formProps.aiSuggest} {...sp} onOpenPrior={onOpenPrior} />
      </Step>
      <Step n={4} title="Notes & accept" state={state(4)} open={cur === 4} onToggle={() => toggle(4)} summary={accepted ? 'Accepted' : ''} last>
        <Notes n={sel} locked={locked} onSave={formProps.onSave} />
        {!locked && (
          <div>
            <div className="flex gap-2">
              <button onClick={onAccept} disabled={!canAccept} title="Accept (A)" className="h-10 flex-1 min-w-24 px-3 rounded-md bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 flex items-center justify-center gap-1.5 whitespace-nowrap"><Check className="w-4 h-4 shrink-0" />Accept {sel.nodule_label} <kbd className="text-[10px] opacity-70 font-normal">A</kbd></button>
              <button onClick={onNext} className="h-10 min-w-20 px-3 rounded-md border border-slate-200 text-sm hover:bg-slate-50 flex items-center justify-center gap-1 whitespace-nowrap">Skip <kbd className="text-[10px] opacity-60">N</kbd></button>
            </div>
            {!canAccept && <p className="text-[11.5px] text-amber-700 mt-1.5">{under4 ? 'Long axis is under 4 mm, so it is not measured. Reject it as "Under 4 mm", or correct the size.' : 'Record the match to prior (step 3) before accepting.'}</p>}
          </div>
        )}
      </Step>
    </div>
  );
}