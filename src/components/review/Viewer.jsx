import { useEffect, useRef, useState } from 'react';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// strokeMode: left-drag draws a stroke (erase brush / outline pen) instead of clicking; onStrokeEnd(points, event).
// Navigation: wheel = slices; Ctrl/⌘ + wheel or trackpad pinch = zoom towards the cursor; drag on the image = pan
// (in Erase / Draw: middle button or Space + drag). focus = {id, box:[x0,y0,x1,y1]}: when the id changes, the view
// centres on the box and zooms so it fills about a quarter of the view.
export const MAX_ZOOM = 12;
export default function Viewer({ src, cols, rows, zoom, setZoom, pan, setPan, onStep, onImageClick, onDrag, onDragEnd, cursor, strokeMode, onStrokeEnd, focus, children }) {
  const boxRef = useRef(), svgRef = useRef();
  const [fit, setFit] = useState(1);
  const [err, setErr] = useState(false);
  const space = useRef(false), panRef = useRef(null), dragRef = useRef(null);
  const strokeRef = useRef(null), skipClick = useRef(false), raf = useRef(0);
  const [stroke, setStroke] = useState(null);
  const [hover, setHover] = useState(null);
  const cb = useRef({});
  cb.current = { onStep, onDrag, onDragEnd, onStrokeEnd, strokeMode, zoom, pan, fit: 0 };
  const [panning, setPanning] = useState(false);

  useEffect(() => setErr(false), [src]);
  useEffect(() => {
    const el = boxRef.current;
    const ro = new ResizeObserver(() => el.clientWidth && setFit(Math.min(el.clientWidth / cols, el.clientHeight / rows) * 0.98));
    ro.observe(el);
    return () => ro.disconnect();
  }, [cols, rows]);

  cb.current.fit = fit;
  // Auto-centre on the selected nodule (once per selection).
  const focused = useRef(null);
  useEffect(() => {
    if (!focus?.box || focused.current === focus.id || !fit) return;
    const el = boxRef.current; if (!el?.clientWidth) return;
    focused.current = focus.id;
    const [x0, y0, x1, y1] = focus.box;
    const size = Math.max(x1 - x0, y1 - y0, 4);
    const zNew = clamp((0.25 * Math.min(el.clientWidth, el.clientHeight)) / (fit * size), 1, MAX_ZOOM);
    const s = fit * zNew;
    setZoom(zNew);
    setPan({ x: -((x0 + x1) / 2 - cols / 2) * s, y: -((y0 + y1) / 2 - rows / 2) * s });
  }, [focus?.id, focus?.box, fit, cols, rows, setZoom, setPan]);

  const toImg = (e) => {
    const svg = svgRef.current, p = svg.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    const r = p.matrixTransform(svg.getScreenCTM().inverse());
    return [Math.round(r.x * 10) / 10, Math.round(r.y * 10) / 10];
  };

  useEffect(() => {
    const el = boxRef.current;
    const wheel = (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        // Zoom towards the cursor: the image point under the cursor stays under the cursor.
        const { zoom: z0, pan: p0, fit: f } = cb.current;
        const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0025));
        const z1 = clamp(z0 * clamp(factor, 0.6, 1.6), 0.5, MAX_ZOOM);
        if (z1 === z0 || !f) return;
        const r = el.getBoundingClientRect();
        const cx = e.clientX - r.left - r.width / 2, cy = e.clientY - r.top - r.height / 2;
        const k = z1 / z0;
        setZoom(z1); setPan({ x: cx - (cx - p0.x) * k, y: cy - (cy - p0.y) * k });
      } else cb.current.onStep(e.deltaY > 0 ? 1 : -1);
    };
    const kd = (e) => { if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) { space.current = true; e.preventDefault(); } };
    const ku = (e) => { if (e.code === 'Space') space.current = false; };
    const mv = (e) => {
      if (panRef.current) {
        const s = panRef.current;
        if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 4) return; // a click, not a drag
        if (!s.moved) { s.moved = true; setPanning(true); }
        setPan({ x: s.px + e.clientX - s.x, y: s.py + e.clientY - s.y });
      }
      else if (dragRef.current) cb.current.onDrag(dragRef.current, toImg(e));
      else if (strokeRef.current) {
        const p = toImg(e), last = strokeRef.current[strokeRef.current.length - 1];
        if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 0.4) strokeRef.current.push(p);
        cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(() => setStroke(strokeRef.current ? [...strokeRef.current] : null));
      }
      if (cb.current.strokeMode && svgRef.current && boxRef.current?.contains(e.target)) setHover(toImg(e));
    };
    const up = (e) => {
      if (dragRef.current) cb.current.onDragEnd(dragRef.current);
      if (strokeRef.current) {
        const pts = strokeRef.current; strokeRef.current = null; setStroke(null);
        if (pts.length > 2) { skipClick.current = true; cb.current.onStrokeEnd?.(pts, e); }
      }
      if (panRef.current?.moved) { skipClick.current = true; setPanning(false); }
      dragRef.current = null; panRef.current = null;
    };
    el.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    return () => {
      el.removeEventListener('wheel', wheel);
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
    };
  }, [setZoom, setPan]);

  const down = (e) => {
    if (e.button === 1 || space.current) { e.preventDefault(); panRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, moved: true }; setPanning(true); }
    else if (e.button === 0 && strokeMode && !dragRef.current) { strokeRef.current = [toImg(e)]; skipClick.current = false; }
    else if (e.button === 0 && !dragRef.current) { skipClick.current = false; panRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, moved: false }; }
  };
  const click = (e) => {
    if (e.button === 0 && !space.current) onImageClick(toImg(e), e);
  };
  const scale = fit * zoom;

  return (
    <div ref={boxRef} onPointerDown={down} onPointerLeave={() => setHover(null)} onContextMenu={(e) => e.preventDefault()}
      onClickCapture={(e) => { if (skipClick.current) { skipClick.current = false; e.stopPropagation(); e.preventDefault(); } }}
      className="relative flex-1 overflow-hidden bg-neutral-900 select-none" style={{ cursor: panning ? 'grabbing' : space.current ? 'grab' : cursor === 'default' ? 'grab' : cursor }}>
      <div className="absolute left-1/2 top-1/2" style={{ width: cols, height: rows, transform: `translate(-50%,-50%) translate(${pan.x}px,${pan.y}px) scale(${scale})` }}>
        <img src={src} width={cols} height={rows} draggable={false} onError={() => setErr(true)} onLoad={() => setErr(false)} className="block max-w-none" alt="CT slice" />
        <svg ref={svgRef} viewBox={`0 0 ${cols} ${rows}`} width={cols} height={rows} className="absolute inset-0 overflow-visible" onClick={click}>
          {children({ scale, stroke, hover: strokeMode ? hover : null, startDrag: (h) => { dragRef.current = h; }, toImg })}
        </svg>
      </div>
      {err && <div className="absolute inset-x-0 bottom-4 text-center text-xs text-neutral-400">Slice image unavailable from the AI engine.</div>}
    </div>
  );
}