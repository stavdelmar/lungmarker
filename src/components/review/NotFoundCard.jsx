import { useEffect, useState } from 'react';
import { HelpCircle, Check, Eye, RotateCcw } from 'lucide-react';
import PriorBox from '@/components/review/PriorBox';
import { fmtMaybe } from '@/components/review/viewerUtils';
import { notFoundNote } from '@/lib/uncertainty';

// A nodule from the prior scan that is not found on this follow-up. Daniel decides:
// "Confirm not found" → exported as Match to prior = "Not found" with his note; or "It's here" → he marks it.
export default function NotFoundCard({ n, locked, prior, onConfirm, onHere, onReopen }) {
  const a = n.ai_draft || {};
  const suggested = notFoundNote(n);
  const [note, setNote] = useState(n.notes || suggested);
  useEffect(() => setNote(n.notes || suggested), [n.id, n.notes]);
  const decided = n.status !== 'Pending';
  return (
    <div className="space-y-3">
      <div className={`rounded-lg border-2 p-3 ${decided ? 'border-slate-200 bg-slate-50' : 'border-amber-400 bg-amber-50'}`}>
        <div className="flex items-start gap-2.5">
          <HelpCircle className={`w-6 h-6 shrink-0 mt-0.5 ${decided ? 'text-slate-400' : 'text-amber-700'}`} />
          <div className="text-[13px] leading-snug">
            <div className="font-semibold text-slate-900">Prior {n.prior_label}: not found in this scan?</div>
            <p className="mt-1 text-slate-700">
              On the prior scan, {n.prior_label} was in {n.lobe || 'an unknown lobe'}
              {a.prior_long != null && <>, <span className="font-mono">{fmtMaybe(a.prior_long)} × {fmtMaybe(a.prior_short)}</span> mm</>}.{' '}
              {a.from_engine ? 'The AI did not find it on this scan.' : 'It was added by hand on the prior scan, so the AI cannot look for it.'}
            </p>
            {n.status === 'Accepted' && <p className="mt-1 font-medium text-slate-800">Confirmed not found. Exported with Match to prior = "Not found".</p>}
            {n.status === 'Rejected' && <p className="mt-1 font-medium text-slate-800">{n.reject_reason?.startsWith('Matched to') ? `${n.reject_reason} on this scan.` : 'Marked as present on this scan.'}</p>}
          </div>
        </div>
      </div>
      <PriorBox {...prior} chosen={n.prior_label} caption={`${n.prior_label} on the prior scan`} />
      {!decided && !locked && (
        <>
          <label className="block"><span className="text-[11px] text-slate-500">Note (goes into the Notes column)</span>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
              className="mt-0.5 w-full px-2 py-1.5 rounded border border-slate-200 text-sm focus:outline-none focus:border-teal-600" /></label>
          <div className="flex gap-2">
            <button onClick={() => onConfirm(n, note.trim())} className="h-9 px-3 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 flex items-center gap-1.5">
              <Check className="w-4 h-4" />Confirm not found <kbd className="text-[10px] opacity-70">A</kbd></button>
            <button onClick={() => onHere(n)} className="h-9 px-3 rounded-md border border-slate-300 bg-white text-sm hover:bg-slate-50 flex items-center gap-1.5">
              <Eye className="w-4 h-4" />It's here</button>
          </div>
          <p className="text-[11.5px] text-slate-500">Scroll the scan first. If it shows up under another number, set that nodule's Match to prior to {n.prior_label}; this item then closes by itself.</p>
        </>
      )}
      {decided && !locked && (
        <button onClick={() => onReopen(n)} className="h-8 px-3 rounded-md border border-slate-300 bg-white text-xs hover:bg-slate-50 flex items-center gap-1.5"><RotateCcw className="w-3.5 h-3.5" />Change decision</button>
      )}
    </div>
  );
}