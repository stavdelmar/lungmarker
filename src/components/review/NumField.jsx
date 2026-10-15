import { useEffect, useState } from 'react';

export default function NumField({ label, value, onCommit, disabled, round = (n) => Math.round(n * 10) / 10, hint, muted }) {
  const [v, setV] = useState(value ?? '');
  useEffect(() => setV(value ?? ''), [value]);
  const commit = () => {
    const n = v === '' ? null : round(Number(v));
    if (n !== (value ?? null)) onCommit(n);
  };
  return (
    <label className={`block ${muted ? 'opacity-55' : ''}`}>
      <span className="text-[11px] text-slate-500">{label}</span>
      <input type="number" step="0.1" disabled={disabled} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="mt-0.5 w-full h-8 px-2 rounded border border-slate-200 bg-white font-mono text-sm focus:outline-none focus:border-teal-600 disabled:bg-slate-50 disabled:text-slate-500" />
      {hint && <span className="block text-[10.5px] text-slate-500 mt-0.5">{hint}</span>}
    </label>
  );
}