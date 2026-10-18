import { ChevronRight, ChevronDown, CheckCircle2, Clock, Link2 } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { priorOf, isApproved } from '@/lib/patients';
import { minutesOnScan, openMinutes } from '@/lib/minutes';


// One patient: a clickable summary row (same action as its button), then — when expanded — its scans in order.
export default function PatientRows({ p, all, expanded, onToggle, onOpen, showMinutes }) {
  const Chev = expanded ? ChevronDown : ChevronRight;
  const cols = showMinutes ? 5 : 4;
  return (
    <>
      <tr onClick={onToggle} className="border-t-2 border-slate-200 cursor-pointer bg-slate-50 hover:bg-slate-100 text-[15px]">
        <td className="px-4 py-4 font-mono font-bold text-slate-900">
          <span className="inline-flex items-center gap-1.5">
            <button onClick={(e) => { e.stopPropagation(); onToggle(); }} aria-label={expanded ? 'Collapse' : 'Expand'} className="w-6 h-6 -ml-1 grid place-items-center rounded hover:bg-slate-200"><Chev className="w-4 h-4 text-slate-400" /></button>
            {p.patient_id}
          </span>
        </td>
        <td className="px-4 text-xs text-slate-600">{p.scans.map((s) => (s.timepoint === 'Baseline' ? 'Baseline' : s.timepoint.replace('Follow-up ', 'FU'))).join(' · ')}</td>
        <td className="px-4">
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 rounded bg-slate-100 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${(p.approved / p.total) * 100}%` }} /></div>
            <span className="font-mono text-xs text-slate-600 whitespace-nowrap">{p.approved}/{p.total}{p.next && <span className="font-sans text-slate-500"> · next: {p.next.timepoint}</span>}</span>
            {p.status === 'Done' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          </div>
        </td>
        {showMinutes && <td className="px-4 font-mono text-xs text-slate-600">{p.minutes || '—'}</td>}
        <td className="px-4 text-right">
          {p.next && (
            <button onClick={(e) => { e.stopPropagation(); onOpen(p.next); }}
              className={`h-8 w-28 rounded-md text-xs font-medium whitespace-nowrap ${p.status === 'Not started' ? 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
              {p.status === 'Not started' ? 'Start →' : 'Continue →'}
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50"><td colSpan={cols} className="pl-6 pr-4 pt-1 pb-4">
          <div className="ml-3 border-l-2 border-slate-300 bg-white rounded-r-md ring-1 ring-slate-200 overflow-hidden">
          <table className="w-full text-xs">
            <tbody>
              {p.scans.map((s) => {
                const prior = priorOf(s, all);
                return (
                  <tr key={s.id} onClick={() => onOpen(s)} className="border-t border-slate-100 first:border-t-0 hover:bg-slate-50 cursor-pointer">
                    <td className="pl-4 pr-4 py-2 whitespace-nowrap font-medium text-slate-700">{s.timepoint}{s.id === p.next?.id && <span className="ml-2 text-[11px] text-teal-700 font-medium">next</span>}</td>
                    <td className="px-4 font-mono text-xs text-slate-600">{String(s.scan_date || '').slice(0, 10) || '—'}</td>
                    <td className="px-4 font-mono text-xs text-slate-600">{s.series_number ?? '—'}</td>
                    <td className="px-4 font-mono text-xs text-slate-600">{s.ai_findings_count ?? '—'}</td>
                    <td className="px-4 whitespace-nowrap"><StatusBadge status={s.review_status || 'Not started'} />{s.approved_by_initials && <span className="ml-2 font-mono text-xs text-slate-500">{s.approved_by_initials}</span>}</td>
                    {showMinutes && <td className="px-4 font-mono text-xs text-slate-600">{minutesOnScan(s) != null ? <>{minutesOnScan(s)}<span className="text-slate-400"> active · {openMinutes(s) ?? '—'} open</span></> : '—'}</td>}
                    <td className="px-4 text-xs">
                      {s.timepoint !== 'Baseline' && (prior ? (
                        <span className={`inline-flex items-center gap-1 ${isApproved(prior) ? 'text-slate-500' : 'text-amber-700'}`}>
                          <Link2 className="w-3.5 h-3.5" />{prior.timepoint} · {isApproved(prior) ? <span className="text-emerald-700">approved</span> : <span className="inline-flex items-center gap-0.5"><Clock className="w-3 h-3" />not approved yet</span>}
                        </span>
                      ) : <span className="text-amber-700">No prior scan found</span>)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </td></tr>
      )}
    </>
  );
}