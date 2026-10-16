import { useEffect, useState } from 'react';
import { parseNum } from '@/lib/reviewChecks';

// One number format on screen whatever the browser's language: a dot and one decimal ("5.3"), volume as a whole number.
// Typing "5,3" is accepted and shown back as "5.3". Saved as a real number (the export writes numbers, not text).
const show = (v, digits) => (v == null || v === '' || !Number.isFinite(Number(v)) ? '' : Number(v).toFixed(digits));

export default function NumField({ label, value, onCommit, disabled, digits = 1, hint, muted, right }) {
  const [v, setV] = useState(show(value, digits));
  useEffect(() => setV(show(value, digits)), [value, digits]);
  const commit = () => {
    const n = parseNum(v);
    if (n === undefined) { setV(show(value, digits)); return; }
    const r = n == null ? null : Number(n.toFixed(digits));
    setV(show(r, digits));
    if (r !== (value == null || value === '' ? null : Number(Number(value).toFixed(digits)))) onCommit(r);
  };
  return (
    <label className="block">
      <span className="text-[11px] text-slate-500">{label}</span>
      <div className="mt-0.5 flex gap-2">
        <input type="text" inputMode="decimal" lang="en" disabled={disabled} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className={`min-w-0 w-full h-8 px-2 rounded border border-slate-200 bg-white font-mono text-sm focus:outline-none focus:border-teal-600 disabled:bg-slate-50 disabled:text-slate-500 ${muted ? 'text-slate-400' : ''}`} />
        {right}
      </div>
      {hint && <span className="block text-[10.5px] text-slate-500 mt-0.5">{hint}</span>}
    </label>
  );
}
