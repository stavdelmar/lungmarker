import { CheckCircle2, RotateCcw, Ruler, MousePointerClick, Scissors, PlusCircle, Eraser, PenLine, Undo2 } from 'lucide-react';

const b = 'h-7 px-2.5 rounded border border-slate-200 bg-white text-xs flex items-center gap-1.5 hover:border-slate-400 disabled:opacity-40 disabled:hover:border-slate-200';

export default function OutlineActions({ n, locked, refineOk, onConfirm, onReset, onRecalc, onFix, onTrim, onGrow, onErase, onDraw, onUndo, quickMode }) {
  const hasOutline = (n.key_contour_px || []).length > 2;
  return (
    <div className="flex flex-wrap gap-1.5">
      <button className={`${b} ${n.outline_confirmed ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : ''}`} disabled={locked || n.outline_confirmed || !hasOutline} onClick={onConfirm}>
        <CheckCircle2 className="w-3.5 h-3.5" /> {n.outline_confirmed ? `Outline confirmed · ${n.outline_confirmed_by_initials}` : 'Confirm outline'}
      </button>
      <button className={b} disabled={locked || !n.ai_draft?.contour?.length} onClick={onReset}><RotateCcw className="w-3.5 h-3.5" /> Reset outline to AI</button>
      <button className={b} disabled={locked || !hasOutline} onClick={onRecalc}><Ruler className="w-3.5 h-3.5" /> Recalculate axes from outline</button>
      <button className={`${b} ${quickMode === 'erase' ? 'border-teal-600 bg-teal-50 text-teal-800' : 'font-medium'}`} disabled={locked} onClick={onErase} title="Drag over part of the outline to cut it away, on any slice (E)"><Eraser className="w-3.5 h-3.5" /> Erase <kbd className="text-[10px] text-slate-400">E</kbd></button>
      <button className={`${b} ${quickMode === 'draw' ? 'border-teal-600 bg-teal-50 text-teal-800' : ''}`} disabled={locked} onClick={onDraw} title="Draw the outline by hand on this slice (D)"><PenLine className="w-3.5 h-3.5" /> Draw <kbd className="text-[10px] text-slate-400">D</kbd></button>
      <button className={b} disabled={locked} onClick={onUndo} title="Undo the last erase / draw (Ctrl+Z)"><Undo2 className="w-3.5 h-3.5" /> Undo</button>
      {refineOk && <button className={`${b} ${quickMode === 'trim' ? 'border-teal-600 bg-teal-50 text-teal-800' : 'font-medium'}`} disabled={locked || !hasOutline} onClick={onTrim} title="One click on a vessel tail removes it (T)"><Scissors className="w-3.5 h-3.5" /> Trim − <kbd className="text-[10px] text-slate-400">T</kbd></button>}
      {refineOk && <button className={`${b} ${quickMode === 'grow' ? 'border-teal-600 bg-teal-50 text-teal-800' : ''}`} disabled={locked || !hasOutline} onClick={onGrow} title="One click adds missed nodule tissue (G)"><PlusCircle className="w-3.5 h-3.5" /> Grow + <kbd className="text-[10px] text-slate-400">G</kbd></button>}
      {refineOk && <button className={b} disabled={locked} onClick={onFix}><MousePointerClick className="w-3.5 h-3.5" /> Fix with clicks</button>}
    </div>
  );
}