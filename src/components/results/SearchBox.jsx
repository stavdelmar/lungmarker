import { Search } from 'lucide-react';

export default function SearchBox({ value, onChange }) {
  return (
    <div className="relative shrink-0">
      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Search Patient ID" className="h-8 w-44 pl-7 pr-2 rounded-md border border-slate-200 bg-white text-sm" />
    </div>
  );
}