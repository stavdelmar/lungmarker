import { useSummary } from '@/components/results/useSummary';
import { minutesOnScan } from '@/lib/minutes';

const PARTS = [['unchanged', 'Accepted unchanged', 'bg-emerald-500'], ['edited', 'Edited', 'bg-teal-600'], ['rejected', 'Rejected', 'bg-red-400'], ['added', 'Added by reviewer', 'bg-slate-500']];

function avgActive(scans, baseline) {
  const v = scans.filter((s) => (s.timepoint === 'Baseline') === baseline).map(minutesOnScan).filter((x) => x != null);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
}

function MinutesRow({ label, before, now }) {
  const max = Math.max(before || 0, now || 0, 1);
  const bar = (name, v, c) => (
    <div className="flex items-center gap-2"><span className="w-24 text-slate-500">{name}</span>
      <div className="flex-1 bg-slate-100 rounded-sm"><div className={`${c} h-5 rounded-sm flex items-center justify-end pr-1.5 text-[11px] font-mono text-white`} style={{ width: `${Math.max(8, ((v || 0) / max) * 100)}%` }}>{v ?? '—'}</div></div>
    </div>
  );
  return (
    <div className="space-y-1 text-xs">
      <div className="text-slate-700 font-medium">{label}</div>
      {bar('Before', before, 'bg-slate-400')}
      {bar('With the tool', now, 'bg-slate-900')}
    </div>
  );
}

export default function Performance({ scans, settings }) {
  const d = useSummary(scans).data;
  const total = d ? PARTS.reduce((s, [k]) => s + d[k], 0) : 0;
  return (
    <div className="space-y-4">
      <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="text-xs font-medium text-slate-700">AI findings · reviewer's decision</div>
        {!d ? <div className="text-xs text-slate-400">{scans.length ? 'Loading…' : 'No approved scans yet.'}</div> : <>
          <div className="flex h-7 rounded overflow-hidden bg-slate-100">
            {PARTS.map(([k, label, c]) => d[k] > 0 && <div key={k} title={`${label}: ${d[k]}`} className={`${c} text-white text-[11px] font-mono grid place-items-center`} style={{ width: `${(d[k] / total) * 100}%` }}>{d[k]}</div>)}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            {PARTS.map(([k, label, c]) => <span key={k} className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-sm ${c}`} />{label} <span className="font-mono text-slate-900">{d[k]}</span></span>)}
          </div>
        </>}
      </section>
      <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="text-xs font-medium text-slate-700">Minutes per scan · before vs with the tool <span className="font-normal text-slate-500">(active minutes)</span></div>
        <MinutesRow label="Baseline" before={settings.baseline_minutes_baseline} now={avgActive(scans, true)} />
        <MinutesRow label="Follow-up" before={settings.baseline_minutes_followup} now={avgActive(scans, false)} />
        <p className="text-[11px] text-slate-500">Active = Minutes on scan: active work without long breaks, as exported.</p>
      </section>
    </div>
  );
}