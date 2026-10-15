// Temporary sample data — replaced by real data next
const SAMPLE = [
  { id: '1', patient_id: 'HTL-0001', scan_date: '2025-01-14', timepoint: 'Baseline', ai_findings_count: 3, review_status: 'Approved', minutes_on_scan: 41, approved_by_initials: 'DR' },
  { id: '2', patient_id: 'HTL-0001', scan_date: '2025-07-10', timepoint: 'Follow-up 1', ai_findings_count: 2, review_status: 'In review', minutes_on_scan: null },
];

export default function Worklist() {
  return (
    <div className="p-6 max-w-7xl w-full mx-auto">
      <h1 className="text-lg font-semibold">Worklist <span className="text-xs text-slate-400">(sample data)</span></h1>
      <table className="mt-4 w-full text-sm bg-white border border-slate-200 rounded-lg">
        <tbody>
          {SAMPLE.map((s) => (
            <tr key={s.id} className="border-t border-slate-100">
              <td className="px-4 py-2 font-mono">{s.patient_id}</td><td className="font-mono">{s.scan_date}</td>
              <td>{s.timepoint}</td><td className="font-mono">{s.ai_findings_count}</td><td>{s.review_status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}