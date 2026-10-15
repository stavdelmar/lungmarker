import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { Download, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useSettings } from '@/hooks/useAppData';
import { useMe } from '@/hooks/useMe';
import { fetchAll, fmt1, fmtDateTime } from '@/lib/data';
import { buildWorkbook } from '@/lib/exportWorkbook';
import { MIN_LONG_AXIS_MM } from '@/lib/exportRows';
import { isPendingExport, selectForExport, markExported, sortKey } from '@/lib/exportSelect';
import SummaryCards from '@/components/results/SummaryCards';
import ChangeSummary from '@/components/results/ChangeSummary';
import ResultDetail from '@/components/results/ResultDetail';

const { Scan, Nodule, EditEvent } = base44.entities;
const today = () => new Date().toISOString().slice(0, 10);
const fmtDay = (v) => new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export default function Results() {
  const { data: settings } = useSettings();
  const me = useMe();
  const qc = useQueryClient();
  const [patient, setPatient] = useState('');
  const [onlyNew, setOnlyNew] = useState(true);
  const [busy, setBusy] = useState(false);
  const [exportMsg, setExportMsg] = useState('');
  const [detail, setDetail] = useState(null);
  const scansQ = useQuery({ queryKey: ['approvedScans'], queryFn: () => fetchAll(Scan, { review_status: 'Approved' }, 'patient_id') });
  const scans = scansQ.data || [];
  const shown = patient ? scans.filter((s) => s.patient_id === patient) : scans;
  const ids = shown.map((s) => s.id);
  const nodQ = useQuery({ queryKey: ['resultNodules', ids.join(',')], enabled: !!scansQ.data, queryFn: () => fetchAll(Nodule, { scan: { $in: ids }, status: 'Accepted' }, 'nodule_label') });
  const sMap = Object.fromEntries(scans.map((s) => [s.id, s]));
  const patients = [...new Set(scans.map((s) => s.patient_id))].sort();
  // Same rows and order as the Excel file (accepted, ≥ 4 mm, grouped by scan, N1, N2…).
  const nodules = (nodQ.data || []).filter((n) => sMap[n.scan] && Number(n.long_axis_mm) >= MIN_LONG_AXIS_MM)
    .sort((a, b) => sortKey(sMap[a.scan], a).localeCompare(sortKey(sMap[b.scan], b)));
  // Only reviewers mark rows as exported; a viewer's export is a plain copy of what is shown.
  const useOnlyNew = me.isReviewer && onlyNew;
  const toExport = useOnlyNew ? nodules.filter(isPendingExport) : nodules;

  const exportExcel = async () => {
    setBusy(true); setExportMsg('');
    try {
      const events = await fetchAll(EditEvent, { scan: { $in: [...new Set(toExport.map((n) => n.scan))] } }, 'edited_at');
      const sel = selectForExport({ scans, nodules: toExport, events, onlyPending: false });
      const wb = buildWorkbook(XLSX, { ...sel, initials: me.initials, date: today() });
      XLSX.writeFile(wb, `lungmarker_export_${today()}${patient ? `_${patient}` : ''}.xlsx`);
      if (me.isReviewer) { await markExported(sel.nodules); qc.invalidateQueries({ queryKey: ['resultNodules'] }); }
      setExportMsg(`${sel.nodules.length} row${sel.nodules.length === 1 ? '' : 's'} exported`);
    } catch (e) { setExportMsg(`Export failed: ${e.message}`); }
    setBusy(false);
  };

  if (!settings || scansQ.isLoading) return <div className="flex-1 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;
  return (
    <div className="px-8 py-6 max-w-[1400px] w-full mx-auto space-y-5">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Results</h1>
        <div className="flex items-center gap-3">
          <select value={patient} onChange={(e) => setPatient(e.target.value)} className="h-8 px-2 rounded-md border border-slate-200 bg-white text-sm">
            <option value="">All patients</option>
            {patients.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          {me.isReviewer && (
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
              <input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} className="accent-slate-900" />
              Only rows not exported yet
            </label>
          )}
          <button onClick={exportExcel} disabled={busy || !toExport.length}
            className="h-8 px-3 rounded-md bg-slate-900 text-white text-sm flex items-center gap-2 hover:bg-slate-800 disabled:opacity-40">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Export to Excel <span className="font-mono text-xs opacity-80">({toExport.length})</span>
          </button>
        </div>
      </div>
      {exportMsg && <p className="text-xs text-slate-500 -mt-3 text-right">{exportMsg}</p>}
      <SummaryCards scanIds={scans.map((s) => s.id)} settings={settings} />
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>{['Patient', 'Timepoint', 'Nodule', 'Lobe', 'Long × short', 'Mean', 'Volume', 'Match to prior', 'Edited', 'Approved by', 'Approved at', 'Exported'].map((h) => <th key={h} className="text-left font-medium px-3 py-2.5">{h}</th>)}</tr>
          </thead>
          <tbody>
            {nodules.map((n) => { const s = sMap[n.scan]; return (
              <tr key={n.id} onClick={() => setDetail(n)} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer">
                <td className="px-3 py-2 font-mono">{s?.patient_id}</td><td className="px-3">{s?.timepoint}</td><td className="px-3 font-mono">{n.nodule_label}</td><td className="px-3">{n.lobe}</td>
                <td className="px-3 font-mono">{fmt1(n.long_axis_mm)} × {fmt1(n.short_axis_mm)}</td><td className="px-3 font-mono">{fmt1(n.mean_diameter_mm)}</td>
                <td className="px-3 font-mono">{n.outline_confirmed && n.volume_mm3 != null ? Math.round(n.volume_mm3) : '—'}</td>
                <td className="px-3 font-mono">{s?.timepoint === 'Baseline' ? '' : n.match_to_prior || '—'}</td>
                <td className="px-3">{n.was_edited ? <span className="text-violet-700">yes</span> : 'no'}</td>
                <td className="px-3 font-mono">{s?.approved_by_initials}</td><td className="px-3 font-mono text-xs">{fmtDateTime(s?.approved_at)}</td>
                <td className="px-3 text-xs whitespace-nowrap">{n.changed_after_export ? <span className="text-amber-700">changed since {fmtDay(n.exported_at)}</span> : n.exported_at ? <span className="text-slate-500">exported {fmtDay(n.exported_at)}</span> : <span className="text-teal-700">new</span>}</td>
              </tr>); })}
            {nodQ.data && !nodules.length && <tr><td colSpan={12} className="py-10 text-center text-slate-400 text-sm">No accepted nodules on approved scans yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <ChangeSummary scans={shown} nodules={nodQ.data || []} />
      <ResultDetail n={detail} scan={detail && sMap[detail.scan]} base={settings.engine_base_url} onClose={() => setDetail(null)} />
    </div>
  );
}