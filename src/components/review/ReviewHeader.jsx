import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// prior: undefined for a Baseline; null if a follow-up has no prior scan in the app.
export default function ReviewHeader({ scan, timer, showTimer, readOnly, prior, onOpenPrior }) {
  return (
    <div className="h-11 flex items-center gap-4 px-4 bg-white border-b border-slate-200 text-sm whitespace-nowrap overflow-hidden">
      <span className="flex items-center gap-1.5 text-sm shrink-0">
        <Link to="/" className="flex items-center text-slate-700 hover:text-slate-900 hover:underline"><ChevronLeft className="w-4 h-4" />Worklist</Link>
        <span className="text-slate-400">/</span>
        <span className="font-mono font-medium">{scan.patient_id}</span>
        <span className="text-slate-400">/</span>
        <span className="text-slate-700">{scan.timepoint}</span>
      </span>
      <span className="font-mono text-slate-500 text-xs cursor-help" title={`Series ${scan.series_number ?? '—'} · ${scan.slice_thickness_mm ?? '—'} mm slices`}>{scan.scan_date?.slice(0, 10)}</span>
      {prior !== undefined && (prior ? (
        <button onClick={onOpenPrior} className="text-xs text-slate-600 hover:text-teal-700 truncate" title="Open the prior scan">
          Prior: <span className="font-medium">{prior.timepoint}</span> · <span className="font-mono">{prior.scan_date?.slice(0, 10)}</span>
        </button>
      ) : <span className="text-xs text-amber-700">No prior scan found</span>)}
      {readOnly && <span className="text-xs text-slate-400">read-only</span>}
      {showTimer && (
        <span className="ml-auto text-xs text-slate-600 shrink-0">
          <span title="Minutes on scan (exported) = active work, without breaks.">Minutes on scan: <span className="font-mono text-slate-900">{mmss(timer.secs)}</span></span>
          {timer.totalPaused
            ? <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[11px]" title="No input for 5 min: the clock doesn't count until you move the mouse, scroll or press a key">paused · idle</span>
            : timer.paused && <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 text-[11px]" title="Active time pauses after a short idle (not counted in Minutes on scan)">active paused</span>}
        </span>
      )}
    </div>
  );
}