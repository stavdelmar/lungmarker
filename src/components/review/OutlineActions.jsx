import { CheckCircle2, RotateCcw, Ruler, MousePointerClick } from 'lucide-react';

const b = 'h-7 px-2.5 rounded border border-slate-200 bg-white text-xs flex items-center gap-1.5 hover:border-slate-400 disabled:opacity-40 disabled:hover:border-slate-200';

export default function OutlineActions({ n, locked, refineOk, onConfirm, onReset, onRecalc, onFix }) {
  const hasOutline = (n.key_contour_px || []).length > 2;
  return (
    <div className="flex flex-wrap gap-1.5">
      <button className={`${b} ${n.outline_confirmed ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : ''}`} disabled={locked || n.outline_confirmed || !hasOutline} onClick={onConfirm}>
        <CheckCircle2 className="w-3.5 h-3.5" /> {n.outline_confirmed ? `Outline confirmed · ${n.outline_confirmed_by_initials}` : 'Confirm outline'}
      </button>
      <button className={b} disabled={locked || !n.ai_draft?.contour?.length} onClick={onReset}><RotateCcw className="w-3.5 h-3.5" /> Reset outline to AI</button>
      <button className={b} disabled={locked || !hasOutline} onClick={onRecalc}><Ruler className="w-3.5 h-3.5" /> Recalculate axes from outline</button>
      {refineOk && <button className={b} disabled={locked} onClick={onFix}><MousePointerClick className="w-3.5 h-3.5" /> Fix with clicks</button>}
    </div>
  );
}