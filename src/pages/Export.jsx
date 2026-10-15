import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { Download, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useMe } from '@/hooks/useMe';
import { fetchAll, fmtDateTime } from '@/lib/data';
import { MEAS_HEADERS, measurementRows, toCsv } from '@/lib/exportRows';
import { buildWorkbook } from '@/lib/exportWorkbook';

const { Scan, Nodule, EditEvent } = base44.entities;
const today = () => new Date().toISOString().slice(0, 10);

export default function Export() {
  const me = useMe();
  const qc = useQueryClient();
  const [includeExported, setIncludeExported] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState('');
  const scansQ = useQuery({ queryKey: ['approvedScans'], queryFn: () => fetchAll(Scan, { review_status: 'Approved' }, 'patient_id') });
  const all = scansQ.data || [];
  const visible = all.filter((s) => includeExported || !s.exported_at);

  useEffect(() => { setSelected(new Set(visible.map((s) => s.id))); }, [scansQ.data, includeExported]);

  const toggle = (id) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const gather = async () => {
    const scans = all.filter((s) => selected.has(s.id));
    const ids = scans.map((s) => s.id);
    const [nodules, events] = await Promise.all([
      fetchAll(Nodule, { scan: { $in: ids }, status: 'Accepted' }, 'nodule_label'),
      fetchAll(EditEvent, { scan: { $in: ids } }, 'edited_at'),
    ]);
    return { scans, nodules, events };
  };
  const markExported = async (scans) => {
    if (!me.isReviewer) return;
    const at = new Date().toISOString();
    await Scan.bulkUpdate(scans.map((s) => ({ id: s.id, exported_at: at })));
    qc.invalidateQueries({ queryKey: ['approvedScans'] });
  };

  const downloadXlsx = async () => {
    setBusy('xlsx');
    const { scans, nodules, events } = await gather();
    const wb = buildWorkbook(XLSX, { scans, nodules, events, initials: me.initials, date: today() });
    XLSX.writeFile(wb, `lungmarker_export_${today()}.xlsx`);
    await markExported(scans);
    setBusy('');
  };

  const downloadCsv = async () => {
    setBusy('csv');
    const { scans, nodules, events } = await gather();
    const blob = new Blob([toCsv(MEAS_HEADERS, measurementRows(scans, nodules, events))], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `lungmarker_export_${today()}.csv`; a.click();
    URL.revokeObjectURL(a.href);
    await markExported(scans);
    setBusy('');
  };

  const btn = 'h-9 px-4 rounded-md text-sm flex items-center gap-2 disabled:opacity-40';
  return (
    <div className="px-8 py-6 max-w-[1100px] w-full mx-auto">
      <h1 className="text-xl font-semibold tracking-tight">Export</h1>
      <p className="text-xs text-slate-500 mt-1">Only approved scans can be exported. One row per accepted nodule.</p>
      <div className="flex items-center gap-4 mt-5">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeExported} onChange={(e) => setIncludeExported(e.target.checked)} className="accent-slate-900" /> Include previously exported</label>
        <span className="text-xs text-slate-500 font-mono">{selected.size} selected</span>
        <div className="ml-auto flex gap-2">
          <button onClick={downloadCsv} disabled={!selected.size || !!busy} className={`${btn} border border-slate-300 bg-white hover:bg-slate-50`}>{busy === 'csv' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}Download CSV</button>
          <button onClick={downloadXlsx} disabled={!selected.size || !!busy} className={`${btn} bg-slate-900 text-white hover:bg-slate-800`}>{busy === 'xlsx' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}Download Excel</button>
        </div>
      </div>
      <div className="mt-3 bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            <tr><th className="w-10 px-4 py-2.5"><input type="checkbox" checked={visible.length > 0 && selected.size === visible.length} onChange={(e) => setSelected(new Set(e.target.checked ? visible.map((s) => s.id) : []))} /></th>
              {['Patient ID', 'Scan date', 'Timepoint', 'Approved by', 'Approved at', 'Exported'].map((h) => <th key={h} className="text-left font-medium px-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => toggle(s.id)}>
                <td className="px-4 py-2"><input type="checkbox" checked={selected.has(s.id)} readOnly /></td>
                <td className="px-3 font-mono">{s.patient_id}</td><td className="px-3 font-mono">{s.scan_date?.slice(0, 10)}</td><td className="px-3">{s.timepoint}</td>
                <td className="px-3 font-mono">{s.approved_by_initials}</td><td className="px-3 font-mono text-xs">{fmtDateTime(s.approved_at)}</td>
                <td className="px-3 font-mono text-xs text-slate-500">{s.exported_at ? fmtDateTime(s.exported_at) : '—'}</td>
              </tr>
            ))}
            {!scansQ.isLoading && !visible.length && <tr><td colSpan={7} className="py-10 text-center text-slate-400 text-sm">No approved scans waiting for export.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}