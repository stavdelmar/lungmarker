import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { engine } from '@/api/engine';
import { useMe } from '@/hooks/useMe';
import { fetchAll } from '@/lib/data';
import { scanOrder } from '@/lib/patients';
import { engineState, withLaterScans, resetScans } from '@/lib/reimport';
import StatusBadge from '@/components/StatusBadge';

const { Scan } = base44.entities;
const STATE = {
  same: ['matches engine', 'text-emerald-700'],
  changed: ['engine output changed', 'text-amber-700 font-medium'],
  unknown: ['can\'t compare (imported before tracking, or engine unreachable)', 'text-slate-500'],
  'not imported': ['not opened yet · will use current output', 'text-slate-500'],
};

// Admin tool for test data: compare imported scans with the engine's current output, and reset scans to
// "never reviewed" so they are set up again from the engine on their next opening.
export default function TestData({ base }) {
  const me = useMe();
  const qc = useQueryClient();
  const scansQ = useQuery({ queryKey: ['scans'], queryFn: () => fetchAll(Scan, {}, 'patient_id') });
  const [states, setStates] = useState({});
  const [checking, setChecking] = useState(false);
  const [sel, setSel] = useState(new Set());
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const scans = useMemo(() => [...(scansQ.data || [])].sort((a, b) => a.patient_id.localeCompare(b.patient_id, undefined, { numeric: true }) || scanOrder(a, b)), [scansQ.data]);
  const affected = withLaterScans(scans.filter((s) => sel.has(s.id)), scans);
  const extra = affected.filter((s) => !sel.has(s.id));
  const approvedN = affected.filter((s) => s.review_status === 'Approved').length;

  const check = async () => {
    setChecking(true); setMsg('');
    const out = {};
    for (const s of scans) {
      if (s.review_status === 'Not started' || !s.ai_fingerprint) { out[s.id] = engineState(s, null); continue; }
      try { out[s.id] = engineState(s, await engine.findings(base, s.engine_scan_id)); } catch { out[s.id] = 'unknown'; }
    }
    setStates(out); setChecking(false);
  };
  const toggle = (id) => setSel((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const pick = (fn) => setSel(new Set(scans.filter(fn).map((s) => s.id)));
  const reset = async () => {
    setBusy(true); setMsg('');
    try {
      const { scans: engineScans = [] } = await engine.scans(base).catch(() => ({}));
      const r = await resetScans(affected, me, { engineScans, reason: 'reset in Settings' });
      setMsg(`${r.scans} scan${r.scans === 1 ? '' : 's'} reset (${r.nodules} nodules removed). They are set up again from the engine when opened. The edit trail keeps the old rows; exports start from the reset.`);
      setSel(new Set()); setAsk(false); setStates({});
      qc.invalidateQueries();
    } catch (e) { setMsg(`Reset failed: ${e.message}`); }
    setBusy(false);
  };

  if (scansQ.isLoading) return <Loader2 className="w-4 h-4 animate-spin text-slate-400" />;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
      <p className="text-xs text-slate-600 leading-relaxed">
        A scan's AI draft is copied from the engine the first time it is opened in Review and then stays as it was. If the engine output changes
        (e.g. a new outline rule), reset the scans you want to start again: their nodules, review, timer and approval are cleared, and the
        current engine output is used on the next opening. Later scans of the same patient are reset with it (they build on the prior's review).
        The edit trail itself is never deleted; exports only use rows from the reset on.
      </p>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button onClick={check} disabled={checking || !base} className="h-8 px-3 rounded-md border border-slate-300 hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-50">
          {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}Check against engine
        </button>
        <span className="text-slate-400">Select:</span>
        <button onClick={() => pick((s) => states[s.id] === 'changed')} className="underline text-slate-700 disabled:opacity-40" disabled={!Object.keys(states).length}>changed</button>
        <button onClick={() => pick(() => true)} className="underline text-slate-700 font-medium">all scans</button>
        <button onClick={() => pick((s) => s.review_status !== 'Not started')} className="underline text-slate-700">all opened / approved</button>
        <button onClick={() => setSel(new Set())} className="underline text-slate-700">none</button>
      </div>
      <table className="w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-slate-500"><tr>
          <th className="w-8" /><th className="text-left font-medium py-1.5">Patient</th><th className="text-left font-medium">Timepoint</th><th className="text-left font-medium">Status</th><th className="text-left font-medium">AI draft vs engine</th><th className="text-left font-medium">Last reset</th>
        </tr></thead>
        <tbody>
          {scans.map((s) => {
            const st = states[s.id] ?? (s.review_status === 'Not started' ? 'not imported' : null);
            const auto = !sel.has(s.id) && affected.some((a) => a.id === s.id);
            return (
              <tr key={s.id} className={`border-t border-slate-100 ${sel.has(s.id) || auto ? 'bg-amber-50/50' : ''}`}>
                <td><input type="checkbox" checked={sel.has(s.id) || auto} disabled={auto} onChange={() => toggle(s.id)} className="accent-slate-900 w-4 h-4 align-middle" aria-label={`Select ${s.patient_id} ${s.timepoint}`} /></td>
                <td className="py-1.5 font-mono">{s.patient_id}</td><td>{s.timepoint}{auto && <span className="ml-1.5 text-[10.5px] text-amber-800">(with its prior)</span>}</td>
                <td><StatusBadge status={s.review_status || 'Not started'} /></td>
                <td className={`text-xs ${st ? STATE[st][1] : 'text-slate-400'}`}>{st ? STATE[st][0] : 'not checked'}</td>
                <td className="text-xs font-mono text-slate-500">{s.reset_at ? new Date(s.reset_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex items-center gap-3">
        {!ask ? (
          <button onClick={() => setAsk(true)} disabled={!affected.length || busy} className="h-9 px-3 rounded-md bg-slate-900 text-white text-sm flex items-center gap-1.5 disabled:opacity-40">
            <RotateCcw className="w-4 h-4" />Reset {affected.length || ''} scan{affected.length === 1 ? '' : 's'} to the engine…
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
            <span>
              Reset <b>{affected.length}</b> scan{affected.length === 1 ? '' : 's'}{extra.length ? ` (incl. ${extra.length} later scan${extra.length === 1 ? '' : 's'} of the same patient)` : ''}
              {approvedN ? <>, <b>{approvedN} approved</b> (their approval and Results rows go too)</> : ''}? This can't be undone.
            </span>
            <button onClick={reset} disabled={busy} className="h-8 px-3 rounded-md bg-amber-600 text-white font-medium flex items-center gap-1.5 disabled:opacity-50">{busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Reset</button>
            <button onClick={() => setAsk(false)} disabled={busy} className="h-8 px-3 rounded-md border border-slate-300 bg-white">Cancel</button>
          </div>
        )}
      </div>
      {msg && <p className="text-xs text-slate-600">{msg}</p>}
    </div>
  );
}