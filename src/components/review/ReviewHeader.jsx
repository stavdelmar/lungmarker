import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, RotateCcw } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// prior: undefined for a Baseline; null if a follow-up has no prior scan in the app.
export default function ReviewHeader({ scan, timer, showTimer, readOnly, prior, onOpenPrior, onResetTimer }) {
  const [ask, setAsk] = useState(false); // inline "are you sure" (no browser dialog)
  return (
    <div className="h-11 flex items-center gap-4 px-4 bg-white border-b border-slate-200 text-sm">
      <Link to="/" className="flex items-center text-slate-500 hover:text-slate-900"><ChevronLeft className="w-4 h-4" />Worklist</Link>
      <span className="font-mono font-medium">{scan.patient_id}</span>
      <span className="text-slate-600">{scan.timepoint}</span>
      <span className="font-mono text-slate-500 text-xs">{scan.scan_date?.slice(0, 10)} · series {scan.series_number ?? '—'} · {scan.slice_thickness_mm ?? '—'} mm</span>
      <StatusBadge status={scan.review_status || 'Not started'} />
      {prior !== undefined && (prior ? (
        <button onClick={onOpenPrior} className="text-xs text-slate-600 hover:text-teal-700" title="Open the prior scan">
          Prior: <span className="font-medium">{prior.timepoint}</span> <span className="font-mono">{prior.scan_date?.slice(0, 10)} · series {prior.series_number ?? '—'}</span> ·{' '}
          {prior.review_status === 'Approved'
            ? <span className="text-emerald-700 font-medium">approved</span>
            : <span className="text-amber-700 font-medium">not approved yet</span>}
        </button>
      ) : <span className="text-xs text-amber-700">No prior scan found</span>)}
      {readOnly && <span className="text-xs text-slate-400">read-only</span>}
      {showTimer && (
        <span className="ml-auto text-xs text-slate-600">
          Time on this scan: <span className="font-mono text-slate-900">{mmss(timer.total)}</span>
          <span className="text-slate-400"> total · </span><span className="font-mono text-slate-900">{mmss(timer.secs)}</span><span className="text-slate-400"> active</span>
          {timer.totalPaused
            ? <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[11px]" title="No input for 5 min: neither clock counts until you move the mouse, scroll or press a key">paused · idle</span>
            : timer.paused && <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 text-[11px]" title="Active time pauses after a short idle; total keeps counting for 5 min">active paused</span>}
          {onResetTimer && (ask ? (
            <span className="ml-2 inline-flex items-center gap-1.5">
              <span className="text-slate-700">Reset both clocks to 0?</span>
              <button onClick={() => { setAsk(false); onResetTimer(); }} className="px-2 h-6 rounded bg-slate-900 text-white">Reset</button>
              <button onClick={() => setAsk(false)} className="px-2 h-6 rounded border border-slate-300">Cancel</button>
            </span>
          ) : (
            <button onClick={() => setAsk(true)} className="ml-2 inline-flex items-center gap-1 text-slate-400 hover:text-slate-700" title="Start this scan's timer from zero (e.g. for the pilot). Logged in the edit trail."><RotateCcw className="w-3 h-3" />Reset</button>
          ))}
        </span>
      )}
    </div>
  );
}