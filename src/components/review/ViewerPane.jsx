import { useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, Loader2, Eraser, PenLine, Undo2, MoreHorizontal, RotateCcw, Scissors, PlusCircle, MousePointerClick } from 'lucide-react';
import { engine } from '@/api/engine';
import { lenMm, fmtMaybe } from '@/components/review/viewerUtils';
import Viewer, { MAX_ZOOM } from '@/components/review/Viewer';
import Overlay from '@/components/review/Overlay';
import SliceSlider from '@/components/review/SliceSlider';

const btn = 'h-7 px-2.5 rounded text-xs border border-neutral-700 text-neutral-300 hover:bg-neutral-800 disabled:opacity-35 disabled:hover:bg-transparent flex items-center gap-1.5';
const on = 'bg-teal-400 text-teal-950 border-teal-400 hover:bg-teal-300';

// Bounding box of a nodule's key-slice outline (or its axes), in image pixels.
function boxOf(n) {
  const pts = [...(n?.key_contour_px || []), ...(n?.long_axis_px || []), ...(n?.short_axis_px || [])];
  if (!pts.length) return null;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

// Outline tools act on the image, so they live on the image toolbar: Erase (E), Draw (D), Undo; rarer ones under ⋯.
function OutlineTools({ t }) {
  const [menu, setMenu] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (!menu) return undefined;
    const h = (e) => { if (!ref.current?.contains(e.target)) setMenu(false); };
    window.addEventListener('pointerdown', h);
    return () => window.removeEventListener('pointerdown', h);
  }, [menu]);
  const dis = !t.on;
  const title = dis ? 'Select a nodule to edit its outline' : undefined;
  const item = 'w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-neutral-800 disabled:opacity-40';
  return (
    <>
      <button className={`${btn} ${t.mode === 'erase' ? on : ''}`} disabled={dis} onClick={t.onErase} title={title || 'Drag over part of the outline to cut it away, on any slice (E)'}><Eraser className="w-3.5 h-3.5" />Erase <kbd className="opacity-60">E</kbd></button>
      <button className={`${btn} ${t.mode === 'draw' ? on : ''}`} disabled={dis} onClick={t.onDraw} title={title || 'Draw the outline by hand on this slice (D)'}><PenLine className="w-3.5 h-3.5" />Draw <kbd className="opacity-60">D</kbd></button>
      <button className={btn} disabled={dis} onClick={t.onUndo} title="Undo the last outline edit (Ctrl+Z)"><Undo2 className="w-3.5 h-3.5" />Undo</button>
      <div className="relative" ref={ref}>
        <button className={btn} disabled={dis} onClick={() => setMenu((m) => !m)} aria-label="More outline actions" title="More outline actions"><MoreHorizontal className="w-3.5 h-3.5" /></button>
        {menu && (
          <div className="absolute z-20 left-0 top-8 w-52 rounded-md border border-neutral-700 bg-neutral-900 shadow-xl py-1 text-neutral-200">
            <button className={item} disabled={!t.onReset} onClick={() => { setMenu(false); t.onReset(); }}><RotateCcw className="w-3.5 h-3.5" />Reset outline to AI</button>
            {t.refineOk && <button className={item} onClick={() => { setMenu(false); t.onTrim(); }}><Scissors className="w-3.5 h-3.5" />Trim − (T)</button>}
            {t.refineOk && <button className={item} onClick={() => { setMenu(false); t.onGrow(); }}><PlusCircle className="w-3.5 h-3.5" />Grow + (G)</button>}
            {t.refineOk && <button className={item} onClick={() => { setMenu(false); t.onFix(); }}><MousePointerClick className="w-3.5 h-3.5" />Fix with clicks</button>}
          </div>
        )}
      </div>
    </>
  );
}

export default function ViewerPane(p) {
  const { meta, base, sid, z, step, setZ, win, setWin, nodules, shapes, sel, draft, editable, mode, clicks, onSelect, onImageClick, onDrag, onDragEnd, showRejected, setShowRejected, modeBar, busy, onStrokeEnd, brushPx, tools } = p;
  const strokeMode = mode === 'erase' || mode === 'draw';
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const n = meta.n_slices || meta.slices?.length || 1;
  const sliceNo = meta.slices?.find((s) => s.z === z)?.slice_number ?? z + 1;
  const sp = meta.pixel_spacing_mm || [1, 1];
  const isKey = !!sel && z === sel.key_slice_z;
  const fitView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  const box = useMemo(() => boxOf(sel), [sel?.id]);
  const focus = useMemo(() => (sel && box ? { id: sel.id, box } : null), [sel?.id, box]);

  useEffect(() => {
    const h = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === '+' || e.key === '=') setZoom((v) => Math.min(MAX_ZOOM, v * 1.2));
      if (e.key === '-') setZoom((v) => Math.max(0.5, v / 1.2));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-neutral-950 text-neutral-200">
      <div className="h-10 flex items-center gap-2 px-3 border-b border-neutral-800 text-xs">
        {(meta.windows || ['lung']).map((w) => (
          <button key={w} onClick={() => setWin(w)} className={`${btn} capitalize ${win === w ? 'bg-neutral-200 text-neutral-900 border-neutral-200 hover:bg-neutral-200' : ''}`}>{w}</button>
        ))}
        {tools && <><span className="w-px h-5 bg-neutral-800 mx-1" /><OutlineTools t={tools} /></>}
        <span className="w-px h-5 bg-neutral-800 mx-1" />
        <button className={btn} onClick={() => setZoom((v) => Math.max(0.5, v / 1.2))} title="Zoom out (−) · Ctrl/⌘ + wheel or pinch zooms at the cursor"><Minus className="w-3 h-3" /></button>
        <span className="font-mono w-10 text-center text-neutral-400">{Math.round(zoom * 100)}%</span>
        <button className={btn} onClick={() => setZoom((v) => Math.min(MAX_ZOOM, v * 1.2))} title="Zoom in (+) · Ctrl/⌘ + wheel or pinch zooms at the cursor"><Plus className="w-3 h-3" /></button>
        <button className={btn} onClick={fitView} title="Show the whole slice">Fit</button>
        <label className="flex items-center gap-1.5 ml-2 text-neutral-400 cursor-pointer whitespace-nowrap">
          <input type="checkbox" checked={showRejected} onChange={(e) => setShowRejected(e.target.checked)} className="accent-teal-400" /> Show rejected
        </label>
        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-300 ml-2" />}
        <div className="ml-auto flex items-center gap-4 font-mono">
          {isKey && draft && <span className="text-fuchsia-300">L {fmtMaybe(lenMm(draft.long_axis_px, sp))} · S {fmtMaybe(lenMm(draft.short_axis_px, sp))} mm</span>}
          <span>Slice #{sliceNo} <span className="text-neutral-500">({z + 1}/{n})</span></span>
        </div>
      </div>
      {modeBar}
      <div className="flex flex-1 min-h-0">
        <Viewer src={engine.sliceUrl(base, sid, win, z)} cols={meta.cols} rows={meta.rows} zoom={zoom} setZoom={setZoom} pan={pan} setPan={setPan}
          onStep={step} onImageClick={onImageClick} onDrag={onDrag} onDragEnd={onDragEnd} cursor={mode === 'erase' ? 'none' : mode ? 'crosshair' : 'default'}
          strokeMode={strokeMode} onStrokeEnd={onStrokeEnd} focus={focus}>
          {({ scale, startDrag, stroke, hover }) => (
            <Overlay shapes={shapes} selId={sel?.id} draft={draft} isKey={isKey} editable={editable && !mode} scale={scale}
              startDrag={startDrag} onSelect={onSelect} clicks={clicks} interactive={!mode} tool={mode} stroke={stroke} hover={hover} brushPx={brushPx} />
          )}
        </Viewer>
        <SliceSlider z={z} n={n} onChange={setZ}
          ticks={nodules.filter((x) => x.key_slice_z != null && (showRejected || x.status !== 'Rejected')).map((x) => ({ id: x.id, z: x.key_slice_z, label: x.nodule_label, sel: x.id === sel?.id }))} />
      </div>
    </div>
  );
}