import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function ReviewHeader({ scan, timer, showTimer, readOnly }) {
  return (
    <div className="h-11 flex items-center gap-4 px-4 bg-white border-b border-slate-200 text-sm">
      <Link to="/" className="flex items-center text-slate-500 hover:text-slate-900"><ChevronLeft className="w-4 h-4" />Worklist</Link>
      <span className="font-mono font-medium">{scan.patient_id}</span>
      <span className="text-slate-600">{scan.timepoint}</span>
      <span className="font-mono text-slate-500 text-xs">{scan.scan_date?.slice(0, 10)} · series {scan.series_number ?? '—'} · {scan.slice_thickness_mm ?? '—'} mm</span>
      <StatusBadge status={scan.review_status || 'Not started'} />
      {readOnly && <span className="text-xs text-slate-400">read-only</span>}
      {showTimer && (
        <span className="ml-auto text-xs text-slate-600">
          Time on this scan: <span className="font-mono text-slate-900">{mmss(timer.secs)}</span>
          {timer.paused && <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 text-[11px]">paused</span>}
        </span>
      )}
    </div>
  );
}