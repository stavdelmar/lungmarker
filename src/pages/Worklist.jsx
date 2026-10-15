import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { engine } from '@/api/engine';
import { useSettings } from '@/hooks/useAppData';
import { useMe } from '@/hooks/useMe';
import StatusBadge from '@/components/StatusBadge';
import EngineOffline from '@/components/EngineOffline';
import { RefreshCw, Loader2 } from 'lucide-react';

const { Scan } = base44.entities;
const CHIPS = ['Not started', 'In review', 'Approved'];

export default function Worklist() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const me = useMe();
  const { data: settings } = useSettings();
  const [chip, setChip] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncErr, setSyncErr] = useState(null);
  const [syncMsg, setSyncMsg] = useState('');

  const scansQ = useQuery({ queryKey: ['scans', chip], queryFn: async () => (await Scan.filter(chip ? { review_status: chip } : {}, { sort: 'patient_id', limit: 300 })).items });
  const countsQ = useQuery({ queryKey: ['scanCounts'], queryFn: async () => ({ total: await Scan.count({}), approved: await Scan.count({ review_status: 'Approved' }) }) });

  const sync = async () => {
    setSyncing(true); setSyncErr(null); setSyncMsg('');
    try {
      const { scans = [] } = await engine.scans(settings?.engine_base_url);
      const existing = new Set((await Scan.list({ distinct: 'engine_scan_id', limit: 5000 })).items);
      const missing = scans.filter((s) => !existing.has(s.scan_id)).map((s) => ({
        engine_scan_id: s.scan_id, patient_id: s.patient_id, scan_date: s.scan_date?.slice(0, 10), timepoint: s.timepoint,
        series_number: s.series_number, slice_thickness_mm: s.slice_thickness_mm, n_slices: s.n_slices,
        prior_engine_scan_id: s.prior_scan_id || '', review_status: 'Not started', active_seconds: 0, ai_findings_count: s.n_findings,
      }));
      if (missing.length) await Scan.bulkCreate(missing);
      setSyncMsg(missing.length ? `${missing.length} new scan${missing.length > 1 ? 's' : ''} added` : 'Already up to date');
      qc.invalidateQueries({ queryKey: ['scans'] }); qc.invalidateQueries({ queryKey: ['scanCounts'] });
    } catch (e) {
      setSyncErr(e.message);
    }
    setSyncing(false);
  };

  const rows = scansQ.data || [];
  return (
    <div className="px-8 py-6 max-w-[1400px] w-full mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Worklist</h1>
          <p className="text-xs text-slate-500 mt-1 font-mono">{countsQ.data ? `${countsQ.data.approved} of ${countsQ.data.total} scans approved` : '…'}</p>
        </div>
        <div className="flex items-center gap-3">
          {syncMsg && <span className="text-xs text-slate-500">{syncMsg}</span>}
          {me.isReviewer && (
            <button onClick={sync} disabled={syncing} className="h-8 px-3 rounded-md bg-slate-900 text-white text-sm flex items-center gap-2 hover:bg-slate-800 disabled:opacity-60">
              {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sync from engine
            </button>
          )}
        </div>
      </div>
      {syncErr && <div className="mt-4"><EngineOffline message={syncErr} onRetry={sync} /></div>}
      <div className="flex gap-2 mt-5">
        {CHIPS.map((c) => (
          <button key={c} onClick={() => setChip(chip === c ? null : c)}
            className={`h-7 px-3 rounded-full text-xs border transition-colors ${chip === c ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}>{c}</button>
        ))}
      </div>
      <div className="mt-3 bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>{['Patient ID', 'Scan date', 'Timepoint', 'AI findings', 'Review status', 'Minutes on scan', 'Approved by'].map((h) => <th key={h} className="text-left font-medium px-4 py-2.5">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} onClick={() => nav(`/review/${s.id}`)} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer">
                <td className="px-4 py-2.5 font-mono">{s.patient_id}</td>
                <td className="px-4 font-mono text-slate-600">{s.scan_date?.slice(0, 10)}</td>
                <td className="px-4">{s.timepoint}</td>
                <td className="px-4 font-mono">{s.ai_findings_count ?? '—'}</td>
                <td className="px-4"><StatusBadge status={s.review_status || 'Not started'} /></td>
                <td className="px-4 font-mono">{s.minutes_on_scan ?? '—'}</td>
                <td className="px-4 font-mono">{s.approved_by_initials || '—'}</td>
              </tr>
            ))}
            {!scansQ.isLoading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-sm">No scans yet{me.isReviewer ? ' — use "Sync from engine".' : '.'}</td></tr>
            )}
            {scansQ.isLoading && <tr><td colSpan={7} className="px-4 py-12 text-center"><Loader2 className="w-4 h-4 animate-spin inline text-slate-400" /></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}