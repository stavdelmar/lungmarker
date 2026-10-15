import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useSettings } from '@/hooks/useAppData';
import { fetchAll, fmt1, fmtDateTime } from '@/lib/data';
import SummaryCards from '@/components/results/SummaryCards';
import ChangeSummary from '@/components/results/ChangeSummary';
import ResultDetail from '@/components/results/ResultDetail';

const { Scan, Nodule } = base44.entities;

export default function Results() {
  const { data: settings } = useSettings();
  const [patient, setPatient] = useState('');
  const [detail, setDetail] = useState(null);
  const scansQ = useQuery({ queryKey: ['approvedScans'], queryFn: () => fetchAll(Scan, { review_status: 'Approved' }, 'patient_id') });
  const scans = scansQ.data || [];
  const shown = patient ? scans.filter((s) => s.patient_id === patient) : scans;
  const ids = shown.map((s) => s.id);
  const nodQ = useQuery({ queryKey: ['resultNodules', ids.join(',')], enabled: !!scansQ.data, queryFn: () => fetchAll(Nodule, { scan: { $in: ids }, status: 'Accepted' }, 'nodule_label') });
  const sMap = Object.fromEntries(scans.map((s) => [s.id, s]));
  const patients = [...new Set(scans.map((s) => s.patient_id))].sort();
  const nodules = (nodQ.data || []).slice().sort((a, b) => `${sMap[a.scan]?.patient_id}${sMap[a.scan]?.scan_date}${a.nodule_label.padStart(4, '0')}`.localeCompare(`${sMap[b.scan]?.patient_id}${sMap[b.scan]?.scan_date}${b.nodule_label.padStart(4, '0')}`));

  if (!settings || scansQ.isLoading) return <div className="flex-1 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;
  return (
    <div className="px-8 py-6 max-w-[1400px] w-full mx-auto space-y-5">
      <div className="flex items-end justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Results</h1>
        <select value={patient} onChange={(e) => setPatient(e.target.value)} className="h-8 px-2 rounded-md border border-slate-200 bg-white text-sm">
          <option value="">All patients</option>
          {patients.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <SummaryCards scanIds={scans.map((s) => s.id)} settings={settings} />
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>{['Patient', 'Timepoint', 'Nodule', 'Lobe', 'Long × short', 'Mean', 'Volume', 'Match to prior', 'Edited', 'Approved by', 'Approved at'].map((h) => <th key={h} className="text-left font-medium px-3 py-2.5">{h}</th>)}</tr>
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
              </tr>); })}
            {nodQ.data && !nodules.length && <tr><td colSpan={11} className="py-10 text-center text-slate-400 text-sm">No accepted nodules on approved scans yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <ChangeSummary scans={shown} nodules={nodQ.data || []} />
      <ResultDetail n={detail} scan={detail && sMap[detail.scan]} base={settings.engine_base_url} onClose={() => setDetail(null)} />
    </div>
  );
}