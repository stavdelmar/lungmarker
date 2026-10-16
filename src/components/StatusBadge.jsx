const STYLES = {
  'Not started': 'bg-slate-100 text-slate-600',
  'In review': 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  Approved: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  Pending: 'bg-slate-100 text-slate-600',
  Accepted: 'bg-emerald-50 text-emerald-700',
  Rejected: 'bg-rose-50 text-rose-700',
  Edited: 'bg-violet-50 text-violet-700',
  'Not found': 'bg-slate-200 text-slate-700',
};

export default function StatusBadge({ status }) {
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${STYLES[status] || STYLES.Pending}`}>{status}</span>;
}