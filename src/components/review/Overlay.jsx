import { uncertainty } from '@/lib/uncertainty';
import { tone, STROKE } from '@/lib/noduleTone';
import { lenMm } from '@/lib/geometry';

const pts = (p) => p.map((q) => q.join(',')).join(' ');
const AXES = ['long_axis_px', 'short_axis_px'];

export default function Overlay({ sp, shapes, selId, draft, isKey, editable, scale, startDrag, onSelect, clicks, interactive, tool, stroke, hover, brushPx, points, toImg }) {
  // Line widths in screen pixels at any zoom (vector-effect ignores the viewer's CSS zoom transform).
  const sw = (w) => w / (scale || 1);
  const r = 4 / scale, fs = 12 / scale;
  return (
    <g>
      {shapes.map(({ n, polys, filled, end }) => polys.filter((p) => p.length > 2).map((p, i) => {
        const isSel = n.id === selId;
        return (
          <polygon key={n.id + i} points={pts(p)} fill={isSel ? (end ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)') : 'transparent'}
            stroke={isSel && end ? '#ffffff' : STROKE[tone(n)]} strokeWidth={sw(isSel ? (end ? 3.5 : 3) : 1)} strokeOpacity={isSel ? 1 : 0.65}
            style={{ filter: isSel ? 'brightness(1.25)' : undefined, cursor: interactive ? 'pointer' : undefined, pointerEvents: interactive ? 'all' : 'none' }}
            strokeDasharray={n.status === 'Rejected' ? `${sw(4)} ${sw(3)}` : filled ? `${sw(2)} ${sw(3)}` : undefined}
            onClick={(e) => { if (!interactive) return; e.stopPropagation(); onSelect(n); }} />
        );
      }))}
      {shapes.map(({ n, polys }) => {
        const p = polys.find((q) => q.length > 2) || (n.id === selId && isKey ? draft?.long_axis_px : null);
        if (!p) return null;
        const x = Math.max(...p.map((q) => q[0])), y = Math.min(...p.map((q) => q[1]));
        return <text key={'t' + n.id} x={x + 5 / scale} y={y} fontSize={fs} fontFamily="JetBrains Mono, monospace" fill={STROKE[tone(n)]} fontWeight={n.id === selId ? 700 : 400} style={{ pointerEvents: 'none' }}>{n.nodule_label}{uncertainty(n).unsure && n.status === 'Pending' ? ' ?' : ''}</text>;
      })}
      {/* Caliper lengths on the lines themselves (follow the drag live). */}
      {isKey && draft && AXES.map((k) => {
        const s = draft[k];
        if (s?.length !== 2) return null;
        const mm = lenMm(s, sp || [1, 1]);
        return <text key={'mm' + k} x={(s[0][0] + s[1][0]) / 2 + 4 / scale} y={(s[0][1] + s[1][1]) / 2 - 4 / scale} fontSize={fs} fontFamily="JetBrains Mono, monospace"
          fill="#f0abfc" stroke="#000" strokeWidth={sw(3)} paintOrder="stroke" style={{ pointerEvents: 'none' }}>{mm == null ? '' : `${mm.toFixed(1)} mm`}</text>;
      })}
      {isKey && draft?.long_axis_px?.length === 2 && <line x1={draft.long_axis_px[0][0]} y1={draft.long_axis_px[0][1]} x2={draft.long_axis_px[1][0]} y2={draft.long_axis_px[1][1]} stroke="#f0abfc" strokeWidth={sw(1.5)} style={{ pointerEvents: 'none' }} />}
      {isKey && draft?.short_axis_px?.length === 2 && <line x1={draft.short_axis_px[0][0]} y1={draft.short_axis_px[0][1]} x2={draft.short_axis_px[1][0]} y2={draft.short_axis_px[1][1]} stroke="#f0abfc" strokeWidth={sw(1.5)} strokeDasharray={`${sw(5)} ${sw(4)}`} style={{ pointerEvents: 'none' }} />}
      {isKey && editable && draft && (
        <>
          {/* Edges: click to add a point there (wide invisible hit line under the points). */}
          {points && (draft.key_contour_px || []).map((p, i, poly) => {
            const q = poly[(i + 1) % poly.length];
            return <line key={'e' + i} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="transparent" strokeWidth={sw(10)} style={{ cursor: 'copy' }} data-edge={i}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); points.add(i, toImg(e)); }} />;
          })}
          {(draft.key_contour_px || []).map((p, i) => {
            const on = points?.selected === i;
            return (
              <circle key={'h' + i} cx={p[0]} cy={p[1]} r={on ? r * 1.4 : r} fill={on ? '#5eead4' : '#0f172a'} stroke={on ? '#ffffff' : '#5eead4'} strokeWidth={sw(on ? 1.6 : 1.2)} style={{ cursor: 'move' }} data-point={i}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => {
                  e.stopPropagation(); e.preventDefault();
                  if (e.altKey && points) { points.remove(i); return; } // Alt+click deletes the point
                  points?.select(i); startDrag({ kind: 'contour', idx: i });
                }} />
            );
          })}
          {AXES.map((k) => (draft[k] || []).map((p, i) => (
            <rect key={k + i} x={p[0] - r} y={p[1] - r} width={r * 2} height={r * 2} fill="#f0abfc" stroke="#0f172a" strokeWidth={sw(1)} style={{ cursor: 'move' }}
              onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); startDrag({ kind: k, idx: i }); }} />
          )))}
        </>
      )}
      {stroke?.length > 1 && (
        <polyline points={pts(stroke)} fill="none" stroke={tool === 'erase' ? 'rgba(248,113,113,0.55)' : '#5eead4'} strokeLinecap="round" strokeLinejoin="round"
          strokeWidth={tool === 'erase' ? brushPx * 2 : sw(1.5)} style={{ pointerEvents: 'none' }} />
      )}
      {tool === 'erase' && hover && <circle cx={hover[0]} cy={hover[1]} r={brushPx} fill="rgba(248,113,113,0.12)" stroke="#f87171" strokeWidth={sw(1)} style={{ pointerEvents: 'none' }} />}
      {clicks.map((c, i) => <circle key={'c' + i} cx={c.x} cy={c.y} r={r * 1.2} fill={c.label ? '#4ade80' : '#f87171'} stroke="#000" strokeWidth={sw(1)} style={{ pointerEvents: 'none' }} />)}
    </g>
  );
}