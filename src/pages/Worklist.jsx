import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { engine } from '@/api/engine';
import { useSettings } from '@/hooks/useAppData';
import { useMe } from '@/hooks/useMe';
import { RefreshCw, Loader2 } from 'lucide-react';
import { fetchAll } from '@/lib/data';
import { groupPatients, isApproved, missingPriorLinks } from '@/lib/patients';
import PatientRows from '@/components/worklist/PatientRows';

const { Scan } = base44.entities;
const CHIPS = [['todo', 'To do'], ['done', 'Done'], ['all', 'All patients']];
const RESYNC_AFTER_MS = 5 * 60 * 1000; // also re-sync when Daniel comes back to the tab after 5+ minutes

function ago(t, now) {
  const m = Math.floor((now - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h ago` : new Date(t).toLocaleDateString('en-GB');
}

export default function Worklist() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const me = useMe();
  const { data: settings } = useSettings();
  const [chip, setChip] = useState('todo');
  const [open, setOpen] = useState({});
  const [sortBy, setSortBy] = useState('status');
  const [syncing, setSyncing] = useState(false);
  const [syncErr, setSyncErr] = useState(null);
  const [syncMsg, setSyncMsg] = useState('');
  const [lastSync, setLastSync] = useState(null);
  const [now, setNow] = useState(Date.now());
  const busyRef = useRef(false);
  const lastRef = useRef(0);

  const scansQ = useQuery({ queryKey: ['scans'], queryFn: () => fetchAll(Scan, {}, 'patient_id') });

  // Adds scans the engine has that the app doesn't (never touches existing ones). Runs by itself when the
  // Worklist opens (reviewers only: only they can create scans); the refresh button is a manual fallback.
  const base = settings?.engine_base_url;
  const sync = useCallback(async () => {
    if (busyRef.current || !base) return;
    busyRef.current = true; setSyncing(true); setSyncErr(null);
    try {
      const { scans = [] } = await engine.scans(base);
      const existing = new Set((await Scan.list({ distinct: 'engine_scan_id', limit: 5000 })).items);
      const missing = scans.filter((s) => !existing.has(s.scan_id)).map((s) => ({
        engine_scan_id: s.scan_id, patient_id: s.patient_id, scan_date: s.scan_date?.slice(0, 10), timepoint: s.timepoint,
        series_number: s.series_number, slice_thickness_mm: s.slice_thickness_mm, n_slices: s.n_slices,
        prior_engine_scan_id: s.prior_scan_id || '', review_status: 'Not started', active_seconds: 0, ai_findings_count: s.n_findings,
      }));
      if (missing.length) await Scan.bulkCreate(missing);
      // Every follow-up gets its prior scan linked (engine link, else the patient's previous timepoint), so Daniel
      // never has to look up the baseline's date and series himself.
      const links = missingPriorLinks(await fetchAll(Scan, {}, 'patient_id'));
      if (links.length) await Scan.bulkUpdate(links);
      setSyncMsg(missing.length ? `${missing.length} new scan${missing.length > 1 ? 's' : ''}` : '');
      const t = Date.now(); lastRef.current = t; setLastSync(t); setNow(t);
      qc.invalidateQueries({ queryKey: ['scans'] });
    } catch (e) {
      setSyncErr(e.message);
    }
    busyRef.current = false; setSyncing(false);
  }, [base, qc]);

  // Sync on open, and again when the tab comes back into view after a while.
  useEffect(() => { if (me.isReviewer && base) sync(); }, [me.isReviewer, base, sync]);
  useEffect(() => {
    if (!me.isReviewer) return undefined;
    const onVisible = () => { if (document.visibilityState === 'visible' && Date.now() - lastRef.current > RESYNC_AFTER_MS) sync(); };
    const tick = setInterval(() => setNow(Date.now()), 30000);
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(tick); document.removeEventListener('visibilitychange', onVisible); };
  }, [me.isReviewer, sync]);

  const all = scansQ.data || [];
  const patients = groupPatients(all);
  const newest = (p) => p.scans.reduce((m, s) => (String(s.scan_date || '') > m ? String(s.scan_date || '') : m), '');
  const filtered = patients.filter((p) => (chip === 'todo' ? p.status !== 'Done' : chip === 'done' ? p.status === 'Done' : true));
  const shown = sortBy === 'newest' ? [...filtered].sort((a, b) => newest(b).localeCompare(newest(a))) : filtered; // 'status' = default order
  const showMinutes = chip === 'done';
  const cols = showMinutes ? 5 : 4;
  const approvedScans = all.filter(isApproved).length;
  const followups = all.filter((s) => s.timepoint !== 'Baseline').length;
  const toggle = (pid) => setOpen((o) => ({ ...o, [pid]: !o[pid] }));
  const isOpen = (p) => open[p.patient_id] ?? p.status === 'In progress';

  return (
    <div className="px-8 py-6 max-w-[1400px] w-full mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Worklist</h1>
          <p className="text-xs text-slate-500 mt-1 font-mono">
            {scansQ.data ? `${patients.filter((p) => p.status === 'Done').length} of ${patients.length} patients done · ${approvedScans} of ${all.length} scans approved · ${followups} follow-ups` : '…'}
          </p>
        </div>
        {me.isReviewer && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            {!base ? (
              <span>AI engine not set up{me.isAdmin ? ' (Settings)' : ''}</span>
            ) : syncErr ? (
              <span className="text-amber-700" title={syncErr}>Couldn't reach the AI engine · showing saved scans</span>
            ) : syncing && !lastSync ? (
              <span>Checking for new scans…</span>
            ) : lastSync ? (
              <span>Updated {ago(lastSync, now)}{syncMsg && <span className="text-teal-700 font-medium"> · {syncMsg}</span>}</span>
            ) : null}
            {base && (
              <button onClick={sync} disabled={syncing} title="Check for new scans now" aria-label="Check for new scans now"
                className="w-7 h-7 grid place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-60">
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 mt-5">
        {CHIPS.map(([k, label]) => (
          <button key={k} onClick={() => setChip(k)}
            className={`h-7 px-3 rounded-full text-xs border transition-colors ${chip === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}>{label}</button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">Sort by:
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="h-7 px-2 rounded-md border border-slate-300 bg-white text-xs text-slate-800">
            <option value="newest">Newest scan</option>
            <option value="status">Status</option>
          </select>
        </label>
      </div>
      <div className="mt-3 bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>{['Patient ID', 'Scans', 'Progress', ...(showMinutes ? ['Minutes on scan'] : []), ''].map((h, i) => <th key={i} className="text-left font-medium px-4 py-2.5">{h}</th>)}</tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <PatientRows key={p.patient_id} p={p} all={all} expanded={isOpen(p)} onToggle={() => toggle(p.patient_id)} onOpen={(s) => nav(`/review/${s.id}`)} showMinutes={showMinutes} />
            ))}
            {!scansQ.isLoading && shown.length === 0 && (
              <tr><td colSpan={cols} className="px-4 py-12 text-center text-slate-400 text-sm">{syncing ? 'Checking the AI engine for scans…' : all.length ? (chip === 'todo' ? 'Nothing left to review.' : 'No patients here.') : 'No scans yet.'}</td></tr>
            )}
            {scansQ.isLoading && <tr><td colSpan={cols} className="px-4 py-12 text-center"><Loader2 className="w-4 h-4 animate-spin inline text-slate-400" /></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}