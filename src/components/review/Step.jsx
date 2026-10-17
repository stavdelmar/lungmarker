import { Check, ChevronDown } from 'lucide-react';

// One step of the nodule stepper. state: done | current | todo | skipped. Closed steps show a one-line summary.
export default function Step({ n, title, state, open, summary, onToggle, last, children }) {
  const dot = state === 'done' ? 'bg-emerald-600 text-white' : state === 'current' ? 'bg-slate-900 text-white ring-4 ring-slate-200' : 'bg-white text-slate-400 border border-slate-300';
  return (
    <div className="relative flex gap-3">
      {!last && <span className="absolute left-[13px] top-8 bottom-0 w-px bg-slate-200" />}
      <span className={`relative z-10 w-7 h-7 shrink-0 rounded-full grid place-items-center text-xs font-semibold ${dot}`}>
        {state === 'done' ? <Check className="w-4 h-4" /> : n}
      </span>
      <div className="flex-1 min-w-0 pb-4">
        <button type="button" onClick={onToggle} className="w-full flex items-center gap-2 text-left min-h-7">
          <span className={`text-sm font-semibold ${state === 'todo' || state === 'skipped' ? 'text-slate-400' : 'text-slate-900'}`}>{title}</span>
          {!open && summary && <span className="text-xs text-slate-500 truncate">· {summary}</span>}
          <ChevronDown className={`ml-auto w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && <div className="mt-2 space-y-3">{children}</div>}
      </div>
    </div>
  );
}