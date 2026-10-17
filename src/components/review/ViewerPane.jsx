import { useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, Loader2, Eraser, PenLine, Undo2, MoreHorizontal, RotateCcw, Scissors, PlusCircle, MousePointerClick, ArrowUp, ArrowDown } from 'lucide-react';
import { engine } from '@/api/engine';
import { fmtMaybe, boxOf } from '@/components/review/viewerUtils';
import PriorPane from '@/components/review/PriorPane';
import Viewer, { MAX_ZOOM } from '@/components/review/Viewer';
import Overlay from '@/components/review/Overlay';
import SliceSlider from '@/components/review/SliceSlider';
import { sliceTicks } from '@/lib/noduleTone';
import { useQuery } from '@tanstack/react-query';
import { initialLink, paneView, linkFromPane } from '@/lib/linkedView';

const btn = 'h-7 px-2.5 rounded text-xs border border-neutral-700 text-neutral-300 hover:bg-neutral-800 disabled:opacity-35 disabled:hover:bg-transparent flex items-center gap-1.5';
const on = 'bg-teal-400 text-teal-950 border-teal-400 hover:bg-teal-300';


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
  const { meta, base, sid, z, step, setZ, win, setWin, nodules, shapes, sel, draft, editable, mode, clicks, onSelect, onImageClick, onDragEnd, showRejected, setShowRejected, modeBar, busy, onStrokeEnd, brushPx, tools, priorView, points, span } = p;
  const strokeMode = mode === 'erase' || mode === 'draw';
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const n = meta.n_slices || meta.slices?.length || 1;
  const sliceNo = meta.slices?.find((s) => s.z === z)?.slice_number ?? z + 1;
  const sp = meta.pixel_spacing_mm || [1, 1];
  const isKey = !!sel && z === sel.key_slice_z;
  const fitView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  const box = useMemo(() => boxOf(sel), [sel?.id]);
  const split = !!priorView;
  // Re-centre on the nodule when the split closes (the pane got wider): a new focus id per close.
  const [splitGen, setSplitGen] = useState(0);
  useEffect(() => { if (!split) setSplitGen((g) => g + 1); }, [split]);
  const focusSingle = useMemo(() => (sel && box ? { id: `${sel.id}:${splitGen}`, box } : null), [sel?.id, box, splitGen]);

  // ---- Split view locked to the prior (Stav, 17 Oct): both panes open centred on their own nodule at the same mm
  // zoom; panning / zooming either pane moves both (shared link, lib/linkedView); scrolling maps slices by mm.
  const pn = priorView?.pn;
  const priSid = priorView?.priorScan?.engine_scan_id;
  const priMetaQ = useQuery({ queryKey: ['meta', base, priSid], enabled: split && !!base && !!priSid, retry: false, queryFn: () => engine.meta(base, priSid) });
  const priMeta = priMetaQ.data;
  const [fits, setFits] = useState({});
  const [link, setLink] = useState(null);
  const linkRef = useRef(null); linkRef.current = link;
  useEffect(() => setLink(null), [pn?.id, sel?.id, split]);
  const curPane = useMemo(() => ({ box, sp, cols: meta.cols, rows: meta.rows, fit: fits.cur?.fit }), [box, sp, meta.cols, meta.rows, fits.cur?.fit]);
  const priBox = useMemo(() => (pn ? boxOf(pn) : null), [pn?.id]);
  const priPane = useMemo(() => (priMeta ? { box: priBox, sp: priMeta.pixel_spacing_mm || [1, 1], cols: priMeta.cols, rows: priMeta.rows, fit: fits.pri?.fit } : null), [priMeta, priBox, fits.pri?.fit]);
  const ready = split && !!priPane && !!fits.cur && !!fits.pri;
  useEffect(() => {
    if (ready && !link) setLink(initialLink({ boxes: [curPane.box, priPane.box], sps: [curPane.sp, priPane.sp], panes: [fits.cur, fits.pri], fits: [fits.cur.fit, fits.pri.fit], maxZoom: MAX_ZOOM }));
  }, [ready, link]);
  const linked = ready && !!link;
  const pendingZoom = useRef(null);
  const adapter = (key, pane) => {
    const cur = () => paneView(linkRef.current, pane);
    return {
      setZoom: (zv) => { // zoom about the pane centre (toolbar / keys); the wheel follows with setPan at the cursor
        const v = cur(); const z1 = typeof zv === 'function' ? zv(v.zoom) : zv; const r = z1 / v.zoom;
        pendingZoom.current = { key, z1 };
        setLink((l) => ({ k: l.k * r, o: [l.o[0] * r, l.o[1] * r] }));
      },
      setPan: (pv) => {
        const v = cur(); const zNow = pendingZoom.current?.key === key ? pendingZoom.current.z1 : v.zoom; pendingZoom.current = null;
        const p = typeof pv === 'function' ? pv(v.pan) : pv;
        setLink(linkFromPane({ zoom: zNow, pan: p }, pane));
      },
    };
  };
  const curAdapter = linked ? adapter('cur', curPane) : null;
  const curView = linked ? { ...paneView(link, curPane), ...curAdapter } : { zoom, pan, setZoom, setPan };
  const priView = linked ? { ...paneView(link, priPane), ...adapter('pri', priPane) } : null;
  const focus = split ? null : focusSingle;
  const zoomCtl = useRef(setZoom); zoomCtl.current = curView.setZoom;
  const fitAll = () => (split ? setLink(null) : fitView());

  // Live drag of outline points / axis ends (Stav, 17 Oct: dragging wasn't smooth). The dragged copy lives here, so a
  // pointer move re-renders only the image (not the whole Review page), at most once per screen frame. Axes and
  // volume are computed once, on release (the page sets them at once, before the save returns).
  const [live, setLive] = useState(null);
  const liveRef = useRef(null), rafRef = useRef(0);
  useEffect(() => { liveRef.current = null; setLive(null); }, [draft]);
  const dragMove = (h, pt) => {
    const cur = liveRef.current || draft;
    const key = h.kind === 'contour' ? 'key_contour_px' : h.kind;
    if (!cur?.[key]) return;
    liveRef.current = { ...cur, [key]: cur[key].map((q, i) => (i === h.idx ? pt : q)) };
    if (!rafRef.current) rafRef.current = requestAnimationFrame(() => { rafRef.current = 0; setLive(liveRef.current); });
  };
  const dragEnd = (h) => {
    cancelAnimationFrame(rafRef.current); rafRef.current = 0;
    const d = liveRef.current; liveRef.current = null;
    if (d) onDragEnd(h, d);
    setLive(null); // same event as the page's new draft → one render, no flash back
  };
  const shownDraft = live || draft;
  const shownShapes = live && sel && isKey ? shapes.map((s) => (s.n.id === sel.id ? { ...s, polys: [live.key_contour_px] } : s)) : shapes;

  useEffect(() => {
    const h = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === '+' || e.key === '=') zoomCtl.current((v) => Math.min(MAX_ZOOM, v * 1.2));
      if (e.key === '-') zoomCtl.current((v) => Math.max(0.5, v / 1.2));
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
        <button className={btn} onClick={() => curView.setZoom((v) => Math.max(0.5, v / 1.2))} title="Zoom out (−) · Ctrl/⌘ + wheel or pinch zooms at the cursor"><Minus className="w-3 h-3" /></button>
        <span className="font-mono w-10 text-center text-neutral-400">{Math.round(curView.zoom * 100)}%</span>
        <button className={btn} onClick={() => curView.setZoom((v) => Math.min(MAX_ZOOM, v * 1.2))} title="Zoom in (+) · Ctrl/⌘ + wheel or pinch zooms at the cursor"><Plus className="w-3 h-3" /></button>
        <button className={btn} onClick={fitAll} title={split ? 'Centre both panes on their nodules again' : 'Show the whole slice'}>Fit</button>
        <label className="flex items-center gap-1.5 ml-2 text-neutral-400 cursor-pointer whitespace-nowrap">
          <input type="checkbox" checked={showRejected} onChange={(e) => setShowRejected(e.target.checked)} className="accent-teal-400" /> Show rejected
        </label>
        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-300 ml-2" />}
      </div>
      {modeBar}
      <div className="flex flex-1 min-h-0">
        {priorView && <PriorPane {...priorView} sel={sel} z={z} step={step} view={priView} curSlices={meta.slices} onFit={(f) => setFits((c) => (c.pri?.fit === f.fit && c.pri?.w === f.w ? c : { ...c, pri: f }))} />}
        <div className={`relative flex flex-1 min-w-0 ${split ? 'border-l border-neutral-700' : ''}`}>
        {/* Corner read-out on the image, as in CT viewers: slice number, window, and the selected nodule's axes. */}
        <div className="absolute left-3 top-2 z-10 pointer-events-none font-mono text-[12px] leading-5 text-neutral-200 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
          <div>Slice #{sliceNo} <span className="text-neutral-400">({z + 1}/{n})</span></div>
          <div className="text-neutral-400">{win.charAt(0).toUpperCase() + win.slice(1)} window</div>
          {sel && <div className="text-white font-semibold">{sel.nodule_label}{isKey ? '' : <span className="text-neutral-400"> · key slice #{meta.slices?.find((s) => s.z === sel.key_slice_z)?.slice_number ?? (sel.key_slice_z ?? 0) + 1}</span>}</div>}
          {sel && sel.kind !== 'prior_not_found' && <div className="text-fuchsia-300 pointer-events-auto w-fit" title="Long axis × Short axis (mm)">{fmtMaybe(sel.long_axis_mm)} × {fmtMaybe(sel.short_axis_mm)} mm</div>}
          {span && (
            <div className="pointer-events-auto flex items-center gap-1 text-neutral-300">
              slices {span.firstNum}–{span.lastNum}
              <button onClick={() => setZ(span.first)} title={`First outlined slice (#${span.firstNum})`} aria-label="Go to first outlined slice" className={`hover:text-teal-300 ${z === span.first ? 'text-teal-300' : ''}`}><ArrowUp className="w-3 h-3" /></button>
              <button onClick={() => setZ(span.last)} title={`Last outlined slice (#${span.lastNum})`} aria-label="Go to last outlined slice" className={`hover:text-teal-300 ${z === span.last ? 'text-teal-300' : ''}`}><ArrowDown className="w-3 h-3" /></button>
            </div>
          )}
        </div>
        {points && isKey && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none rounded bg-black/60 px-2 py-1 text-[11px] text-neutral-300 whitespace-nowrap">
            Drag a point to move it · click the outline to add one · Alt+click{points.selected != null ? ' or Backspace' : ''} to delete
          </div>
        )}
        <Viewer src={engine.sliceUrl(base, sid, win, z)} cols={meta.cols} rows={meta.rows} zoom={curView.zoom} setZoom={curView.setZoom} pan={curView.pan} setPan={curView.setPan}
          onFit={(f) => setFits((c) => (c.cur?.fit === f.fit && c.cur?.w === f.w ? c : { ...c, cur: f }))}
          onStep={step} onImageClick={onImageClick} onDrag={dragMove} onDragEnd={dragEnd} cursor={mode === 'erase' ? 'none' : mode ? 'crosshair' : 'default'}
          strokeMode={strokeMode} onStrokeEnd={onStrokeEnd} focus={focus}>
          {({ scale, startDrag, stroke, hover, toImg }) => (
            <Overlay sp={sp} shapes={shownShapes} selId={sel?.id} draft={shownDraft} isKey={isKey} editable={editable && !mode} scale={scale}
              startDrag={startDrag} onSelect={onSelect} clicks={clicks} interactive={!mode} tool={mode} stroke={stroke} hover={hover} brushPx={brushPx} points={points} toImg={toImg} />
          )}
        </Viewer>
        </div>
        <SliceSlider z={z} n={n} onChange={setZ} range={span}
          ticks={sliceTicks(nodules, sel?.id, showRejected)} />
      </div>
    </div>
  );
}