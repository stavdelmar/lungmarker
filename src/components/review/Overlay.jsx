import { uncertainty } from '@/lib/uncertainty';

const pts = (p) => p.map((q) => q.join(',')).join(' ');
const AXES = ['long_axis_px', 'short_axis_px'];

export default function Overlay({ shapes, selId, draft, isKey, editable, scale, startDrag, onSelect, clicks, interactive, tool, stroke, hover, brushPx }) {
  const r = 4 / scale, fs = 12 / scale;
  return (
    <g>
      {shapes.map(({ n, polys, filled }) => polys.filter((p) => p.length > 2).map((p, i) => {
        const isSel = n.id === selId;
        return (
          <polygon key={n.id + i} points={pts(p)} fill={isSel ? 'rgba(94,234,212,0.07)' : 'transparent'}
            stroke={isSel ? '#5eead4' : n.status === 'Rejected' ? '#f87171' : '#fbbf24'} strokeWidth={isSel ? 2.5 : 1}
            strokeDasharray={n.status === 'Rejected' ? '4 3' : filled ? '2 3' : undefined} vectorEffect="non-scaling-stroke"
            style={{ cursor: interactive ? 'pointer' : undefined, pointerEvents: interactive ? 'all' : 'none' }}
            onClick={(e) => { if (!interactive) return; e.stopPropagation(); onSelect(n); }} />
        );
      }))}
      {shapes.map(({ n, polys }) => {
        const p = polys.find((q) => q.length > 2) || (n.id === selId && isKey ? draft?.long_axis_px : null);
        if (!p) return null;
        const x = Math.max(...p.map((q) => q[0])), y = Math.min(...p.map((q) => q[1]));
        return <text key={'t' + n.id} x={x + 5 / scale} y={y} fontSize={fs} fontFamily="JetBrains Mono, monospace" fill={n.id === selId ? '#5eead4' : '#fbbf24'} style={{ pointerEvents: 'none' }}>{n.nodule_label}{uncertainty(n).unsure ? ' ?' : ''}</text>;
      })}
      {isKey && draft?.long_axis_px?.length === 2 && <line x1={draft.long_axis_px[0][0]} y1={draft.long_axis_px[0][1]} x2={draft.long_axis_px[1][0]} y2={draft.long_axis_px[1][1]} stroke="#f0abfc" strokeWidth={1.5} vectorEffect="non-scaling-stroke" style={{ pointerEvents: 'none' }} />}
      {isKey && draft?.short_axis_px?.length === 2 && <line x1={draft.short_axis_px[0][0]} y1={draft.short_axis_px[0][1]} x2={draft.short_axis_px[1][0]} y2={draft.short_axis_px[1][1]} stroke="#f0abfc" strokeWidth={1.5} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" style={{ pointerEvents: 'none' }} />}
      {isKey && editable && draft && (
        <>
          {(draft.key_contour_px || []).map((p, i) => (
            <circle key={'h' + i} cx={p[0]} cy={p[1]} r={r} fill="#0f172a" stroke="#5eead4" strokeWidth={1.2} vectorEffect="non-scaling-stroke" style={{ cursor: 'move' }}
              onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); startDrag({ kind: 'contour', idx: i }); }} />
          ))}
          {AXES.map((k) => (draft[k] || []).map((p, i) => (
            <rect key={k + i} x={p[0] - r} y={p[1] - r} width={r * 2} height={r * 2} fill="#f0abfc" stroke="#0f172a" strokeWidth={1} vectorEffect="non-scaling-stroke" style={{ cursor: 'move' }}
              onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); startDrag({ kind: k, idx: i }); }} />
          )))}
        </>
      )}
      {stroke?.length > 1 && (
        <polyline points={pts(stroke)} fill="none" stroke={tool === 'erase' ? 'rgba(248,113,113,0.55)' : '#5eead4'} strokeLinecap="round" strokeLinejoin="round"
          strokeWidth={tool === 'erase' ? brushPx * 2 : 1.5} vectorEffect={tool === 'erase' ? undefined : 'non-scaling-stroke'} style={{ pointerEvents: 'none' }} />
      )}
      {tool === 'erase' && hover && <circle cx={hover[0]} cy={hover[1]} r={brushPx} fill="rgba(248,113,113,0.12)" stroke="#f87171" strokeWidth={1} vectorEffect="non-scaling-stroke" style={{ pointerEvents: 'none' }} />}
      {clicks.map((c, i) => <circle key={'c' + i} cx={c.x} cy={c.y} r={r * 1.2} fill={c.label ? '#4ade80' : '#f87171'} stroke="#000" strokeWidth={1} vectorEffect="non-scaling-stroke" style={{ pointerEvents: 'none' }} />)}
    </g>
  );
}