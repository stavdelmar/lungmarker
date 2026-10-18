import { useSummary } from '@/components/results/useSummary';
import PerfTiles from '@/components/results/PerfTiles';
import MinutesCompare, { scanMinutes } from '@/components/results/MinutesCompare';

const PARTS = [['unchanged', 'Accepted unchanged', 'bg-emerald-500'], ['edited', 'Edited', 'bg-teal-600'], ['rejected', 'Rejected', 'bg-red-400'], ['added', 'Added by reviewer', 'bg-slate-500']];

export default function Performance({ scans, settings }) {
  const d = useSummary(scans).data;
  const base = scanMinutes(scans.filter((s) => s.timepoint === 'Baseline'));
  const fu = scanMinutes(scans.filter((s) => s.timepoint !== 'Baseline'));
  const total = d ? PARTS.reduce((s, [k]) => s + d[k], 0) : 0;
  return (
    <div className="space-y-4">
      {d && <PerfTiles d={d} />}
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
      <section className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="text-xs font-medium text-slate-700 mb-1">Minutes per scan · before vs with the tool</div>
        <div className="flex items-center gap-3 text-[11px] text-slate-500 mb-1">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-600" />Before</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-600" />With the tool, median</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-blue-600/60" />Each scan</span>
          <span className="flex items-center gap-1"><span className="h-3 border-l border-dashed border-slate-400" />Target: half the time</span>
        </div>
        <MinutesCompare label="Baseline" before={settings.baseline_minutes_baseline} values={base} />
        <MinutesCompare label="Follow-up" before={settings.baseline_minutes_followup} values={fu} />
        <div className="flex ml-[5.75rem] mr-[6.75rem] justify-between text-[10px] font-mono text-slate-400 border-t border-slate-200 pt-1">
          {[0, 10, 20, 30, 40, 50, 60].map((t) => <span key={t}>{t}</span>)}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Active minutes, as exported.{(base.length < 5 || fu.length < 5) && ' Fewer than 5 scans: not yet a reliable comparison.'}</p>
      </section>
    </div>
  );
}