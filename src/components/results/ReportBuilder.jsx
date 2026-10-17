import { useState } from 'react';
import { AlertTriangle, Columns3 } from 'lucide-react';
import { MEAS_HEADERS } from '@/lib/exportRows';

const input = 'h-8 px-2 rounded-md border border-slate-300 bg-white text-xs';

// Report filters: date range (approval or scan date), patient, and the Excel columns (all 18, master-sheet order).
export default function ReportBuilder({ f, setF, patients, exportButton }) {
  const [colsOpen, setColsOpen] = useState(false);
  const set = (k, v) => setF((cur) => ({ ...cur, [k]: v }));
  const toggleCol = (h) => set('cols', f.cols.includes(h) ? f.cols.filter((c) => c !== h) : MEAS_HEADERS.filter((c) => c === h || f.cols.includes(c)));
  const removed = MEAS_HEADERS.length - f.cols.length;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <span>Approved</span>
        <input type="date" value={f.from} onChange={(e) => set('from', e.target.value)} className={input} aria-label="From" />
        <span>to</span>
        <input type="date" value={f.to} onChange={(e) => set('to', e.target.value)} className={input} aria-label="To" />
        <select value={f.patient} onChange={(e) => set('patient', e.target.value)} className={`${input} ml-2`}>
          <option value="">All patients</option>
          {patients.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={() => setColsOpen((o) => !o)} className={`${input} flex items-center gap-1.5 hover:bg-slate-50`}>
          <Columns3 className="w-3.5 h-3.5" />Columns <span className="font-mono">{f.cols.length}/{MEAS_HEADERS.length}</span>
        </button>
        {exportButton}
        {(f.from || f.to || f.patient) && <button onClick={() => setF((cur) => ({ ...cur, from: '', to: '', patient: '' }))} className="text-teal-700 hover:underline">Clear</button>}
      </div>
      {colsOpen && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs">
          {MEAS_HEADERS.map((h) => (
            <label key={h} className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={f.cols.includes(h)} onChange={() => toggleCol(h)} className="accent-slate-900" />{h}</label>
          ))}
          {removed > 0 && <button onClick={() => set('cols', MEAS_HEADERS)} className="text-teal-700 hover:underline">All columns</button>}
        </div>
      )}
      {removed > 0 && <div className="flex items-center gap-1.5 text-xs text-red-700"><AlertTriangle className="w-3.5 h-3.5" />{removed} column{removed === 1 ? '' : 's'} removed: this export won't paste directly into the master sheet.</div>}
    </div>
  );
}