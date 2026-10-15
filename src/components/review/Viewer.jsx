import { useEffect, useRef, useState } from 'react';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// strokeMode: left-drag draws a stroke (erase brush / outline pen) instead of clicking; onStrokeEnd(points, event).
export default function Viewer({ src, cols, rows, zoom, setZoom, pan, setPan, onStep, onImageClick, onDrag, onDragEnd, cursor, strokeMode, onStrokeEnd, children }) {
  const boxRef = useRef(), svgRef = useRef();
  const [fit, setFit] = useState(1);
  const [err, setErr] = useState(false);
  const space = useRef(false), panRef = useRef(null), dragRef = useRef(null);
  const strokeRef = useRef(null), skipClick = useRef(false), raf = useRef(0);
  const [stroke, setStroke] = useState(null);
  const [hover, setHover] = useState(null);
  const cb = useRef({});
  cb.current = { onStep, onDrag, onDragEnd, onStrokeEnd, strokeMode };

  useEffect(() => setErr(false), [src]);
  useEffect(() => {
    const el = boxRef.current;
    const ro = new ResizeObserver(() => setFit(Math.min(el.clientWidth / cols, el.clientHeight / rows) * 0.98));
    ro.observe(el);
    return () => ro.disconnect();
  }, [cols, rows]);

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
      if (e.ctrlKey) setZoom((z) => clamp(z * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 0.5, 10));
      else cb.current.onStep(e.deltaY > 0 ? 1 : -1);
    };
    const kd = (e) => { if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) { space.current = true; e.preventDefault(); } };
    const ku = (e) => { if (e.code === 'Space') space.current = false; };
    const mv = (e) => {
      if (panRef.current) { const s = panRef.current; setPan({ x: s.px + e.clientX - s.x, y: s.py + e.clientY - s.y }); }
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
    if (e.button === 1 || space.current) { e.preventDefault(); panRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; }
    else if (e.button === 0 && strokeMode && !dragRef.current) { strokeRef.current = [toImg(e)]; skipClick.current = false; }
  };
  const click = (e) => {
    if (skipClick.current) { skipClick.current = false; return; }
    if (e.button === 0 && !space.current) onImageClick(toImg(e), e);
  };
  const scale = fit * zoom;

  return (
    <div ref={boxRef} onPointerDown={down} onPointerLeave={() => setHover(null)} onContextMenu={(e) => e.preventDefault()} className="relative flex-1 overflow-hidden bg-neutral-900 select-none" style={{ cursor: space.current ? 'grab' : cursor }}>
      <div className="absolute left-1/2 top-1/2" style={{ width: cols, height: rows, transform: `translate(-50%,-50%) translate(${pan.x}px,${pan.y}px) scale(${scale})` }}>
        <img src={src} width={cols} height={rows} draggable={false} onError={() => setErr(true)} onLoad={() => setErr(false)} className="block max-w-none" alt="CT slice" />
        <svg ref={svgRef} viewBox={`0 0 ${cols} ${rows}`} width={cols} height={rows} className="absolute inset-0 overflow-visible" onClick={click}>
          {children({ scale, stroke, hover: strokeMode ? hover : null, startDrag: (h) => { dragRef.current = h; } })}
        </svg>
      </div>
      {err && <div className="absolute inset-x-0 bottom-4 text-center text-xs text-neutral-400">Slice image unavailable from the AI engine.</div>}
    </div>
  );
}