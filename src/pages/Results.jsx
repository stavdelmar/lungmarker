import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { Download, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useSettings } from '@/hooks/useAppData';
import { useMe } from '@/hooks/useMe';
import { fetchAll, fmt1, fmtDateTime } from '@/lib/data';
import { buildWorkbook } from '@/lib/exportWorkbook';
import { exportable } from '@/lib/exportRows';
import { selectForExport, markExported, sortKey, exportStatus, preselect } from '@/lib/exportSelect';
import SummaryCards from '@/components/results/SummaryCards';
import PatientChanges from '@/components/results/PatientChanges';
import ResultDetail from '@/components/results/ResultDetail';

const { Scan, Nodule, EditEvent } = base44.entities;
const today = () => new Date().toISOString().slice(0, 10);
const fmtDay = (v) => new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export default function Results() {
  const { data: settings } = useSettings();
  const me = useMe();
  const qc = useQueryClient();
  const [patient, setPatient] = useState('');
  const [view, setView] = useState('all'); // filter chips: they only change what the table shows
  const [selected, setSelected] = useState(new Set());
  const seen = useRef(new Set());
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
  const nodules = (nodQ.data || []).filter((n) => sMap[n.scan] && exportable(n))
    .sort((a, b) => sortKey(sMap[a.scan], a).localeCompare(sortKey(sMap[b.scan], b)));
  const counts = { new: nodules.filter((n) => exportStatus(n) === 'new').length, changed: nodules.filter((n) => exportStatus(n) === 'changed').length };
  const visible = view === 'new' ? nodules.filter((n) => exportStatus(n) === 'new') : view === 'changed' ? nodules.filter((n) => exportStatus(n) === 'changed') : nodules;
  // Rows not exported yet or changed since are pre-selected when they first appear; after that the checkboxes decide.
  const rowKey = nodules.map((n) => `${n.id}:${exportStatus(n)}`).join(',');
  useEffect(() => {
    if (!nodQ.data) return;
    setSelected((cur) => { const r = preselect(nodules, cur, seen.current); seen.current = r.seen; return r.selected; });
  }, [rowKey, !!nodQ.data]); // eslint-disable-line react-hooks/exhaustive-deps
  // What gets exported = the ticked rows (of the chosen patient), whatever chip is on. Only reviewers mark rows
  // as exported; a viewer's (Naomi's) export is a plain copy.
  const toExport = nodules.filter((n) => selected.has(n.id));
  const toggle = (id) => setSelected((cur) => { const s2 = new Set(cur); if (s2.has(id)) s2.delete(id); else s2.add(id); return s2; });
  const allVisibleOn = visible.length > 0 && visible.every((n) => selected.has(n.id));
  const someVisibleOn = visible.some((n) => selected.has(n.id));
  const toggleAll = () => setSelected((cur) => { const s2 = new Set(cur); visible.forEach((n) => (allVisibleOn ? s2.delete(n.id) : s2.add(n.id))); return s2; });
  const hiddenSelected = toExport.filter((n) => !visible.includes(n)).length;

  const exportExcel = async () => {
    setBusy(true); setExportMsg('');
    try {
      const events = await fetchAll(EditEvent, { scan: { $in: [...new Set(toExport.map((n) => n.scan))] } }, 'edited_at');
      const sel = selectForExport({ scans, nodules: toExport, events, onlyPending: false });
      const wb = buildWorkbook(XLSX, { ...sel, initials: me.initials, date: today() });
      XLSX.writeFile(wb, `lungmarker_export_${today()}${patient ? `_${patient}` : ''}.xlsx`);
      if (me.isReviewer) {
        await markExported(sel.nodules);
        setSelected((cur) => { const s2 = new Set(cur); sel.nodules.forEach((n) => s2.delete(n.id)); return s2; });
        qc.invalidateQueries({ queryKey: ['resultNodules'] });
      }
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
          <button onClick={exportExcel} disabled={busy || !toExport.length}
            className="h-8 px-3 rounded-md bg-slate-900 text-white text-sm flex items-center gap-2 hover:bg-slate-800 disabled:opacity-40">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Export selected <span className="font-mono text-xs opacity-80">({toExport.length})</span>
          </button>
        </div>
      </div>
      {exportMsg && <p className="text-xs text-slate-500 -mt-3 text-right">{exportMsg}</p>}
      <SummaryCards scanIds={scans.map((s) => s.id)} scans={scans} settings={settings} />
      <div className="flex items-center gap-2">
        {[['all', 'All', nodules.length], ['new', 'Not exported', counts.new], ['changed', 'Changed since export', counts.changed]].map(([k, label, c]) => (
          <button key={k} onClick={() => setView(k)} className={`h-7 px-3 rounded-full text-xs border ${view === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
            {label} <span className="font-mono opacity-75">({c})</span>
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-500">
          {toExport.length} selected{hiddenSelected ? ` (${hiddenSelected} not shown by this filter)` : ''}{!me.isReviewer && ' · viewer export does not mark rows as exported'}
        </span>
      </div>
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            <tr><th className="pl-3 pr-1 py-2.5 w-8"><input type="checkbox" aria-label="Select all rows shown" checked={allVisibleOn} ref={(el) => { if (el) el.indeterminate = !allVisibleOn && someVisibleOn; }} onChange={toggleAll} className="accent-slate-900 w-4 h-4 align-middle" /></th>{['Patient', 'Timepoint', 'Nodule', 'Lobe', 'Long × short', 'Mean', 'Volume', 'Match to prior', 'Edited', 'Minutes (total · active)', 'Approved by', 'Approved at', 'Export status', ''].map((h) => <th key={h} className="text-left font-medium px-3 py-2.5">{h}</th>)}</tr>
          </thead>
          <tbody>
            {visible.map((n) => { const s = sMap[n.scan]; const st = exportStatus(n); return (
              <tr key={n.id} onClick={() => setDetail(n)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetail(n); } }} title="Open the details: image, AI vs final, edit history"
                className={`group border-t border-slate-100 hover:bg-slate-50 cursor-pointer focus:outline-none focus-visible:bg-slate-100 ${selected.has(n.id) ? 'bg-teal-50/40' : ''}`}>
                <td className="pl-3 pr-1" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${s?.patient_id} ${s?.timepoint} ${n.nodule_label || ''}`} checked={selected.has(n.id)} onChange={() => toggle(n.id)} className="accent-slate-900 w-4 h-4 align-middle" /></td>
                <td className="px-3 py-2 font-mono whitespace-nowrap">{s?.patient_id}</td><td className="px-3 whitespace-nowrap">{s?.timepoint}</td><td className="px-3 font-mono">{n.nodule_label || <span className="text-slate-500">prior {n.prior_label}</span>}</td><td className="px-3">{n.lobe}</td>
                <td className="px-3 font-mono whitespace-nowrap">{fmt1(n.long_axis_mm)} × {fmt1(n.short_axis_mm)}</td><td className="px-3 font-mono">{fmt1(n.mean_diameter_mm)}</td>
                <td className="px-3 font-mono">{n.outline_confirmed && n.volume_mm3 != null ? Math.round(n.volume_mm3) : <span className="font-sans text-[11px] text-slate-400 whitespace-nowrap">outline not confirmed</span>}</td>
                <td className="px-3 font-mono">{s?.timepoint === 'Baseline' ? '' : n.match_to_prior || '—'}</td>
                <td className="px-3">{n.was_edited ? 'yes' : 'no'}</td>
                <td className="px-3 font-mono whitespace-nowrap">{s?.minutes_on_scan ?? '—'}<span className="text-slate-400"> · {s?.active_minutes ?? '—'}</span></td>
                <td className="px-3 font-mono">{s?.approved_by_initials}</td><td className="px-3 font-mono text-xs">{fmtDateTime(s?.approved_at)}</td>
                <td className="px-3 text-xs whitespace-nowrap">
                  {st === 'changed' ? <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900" title={`Exported ${fmtDay(n.exported_at)}, edited after that`}>Changed since export</span>
                    : st === 'exported' ? <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">Exported {fmtDay(n.exported_at)}</span>
                    : <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-900">New</span>}
                </td>
                <td className="pr-3 text-xs text-slate-400 group-hover:text-teal-700 whitespace-nowrap">Details ›</td>
              </tr>); })}
            {nodQ.data && nodules.length > 0 && !visible.length && <tr><td colSpan={15} className="py-8 text-center text-slate-400 text-sm">No rows in this filter.</td></tr>}
            {nodQ.data && !nodules.length && <tr><td colSpan={15} className="py-10 text-center text-slate-400 text-sm">No accepted nodules on approved scans yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <PatientChanges scans={shown} nodules={nodQ.data || []} />
      <ResultDetail n={detail} scan={detail && sMap[detail.scan]} base={settings.engine_base_url} onClose={() => setDetail(null)} />
    </div>
  );
}