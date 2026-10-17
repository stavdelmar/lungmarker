import { ArrowUp, ArrowDown } from 'lucide-react';

// Quick check of the outline's top and bottom slices (small end slices are easy to miss).
export default function OutlineEnds({ span, z, goSlice }) {
  if (!span || !goSlice) return null;
  const btn = (on) => `h-7 px-2.5 rounded-md border text-xs flex items-center gap-1 whitespace-nowrap ${on ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs">
      <span className="text-slate-700">Outline spans slices <b className="font-mono">{span.firstNum}–{span.lastNum}</b></span>
      <span className="ml-auto flex gap-1.5">
        <button onClick={() => goSlice(span.first)} className={btn(z === span.first)}><ArrowUp className="w-3.5 h-3.5" />First slice</button>
        <button onClick={() => goSlice(span.last)} className={btn(z === span.last)}><ArrowDown className="w-3.5 h-3.5" />Last slice</button>
      </span>
    </div>
  );
}