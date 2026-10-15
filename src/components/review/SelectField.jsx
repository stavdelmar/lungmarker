export default function SelectField({ label, value, options, onChange, disabled, placeholder = '—' }) {
  return (
    <label className="block">
      <span className="text-[11px] text-slate-500">{label}</span>
      <select value={value || ''} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full h-8 px-1.5 rounded border border-slate-200 bg-white text-sm focus:outline-none focus:border-teal-600 disabled:bg-slate-50 disabled:text-slate-500">
        <option value="">{placeholder}</option>
        {options.map((o) => {
          const val = typeof o === 'string' ? o : o.value;
          return <option key={val} value={val}>{typeof o === 'string' ? o : o.label}</option>;
        })}
      </select>
    </label>
  );
}