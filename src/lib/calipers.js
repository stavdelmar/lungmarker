import { lenMm } from '@/lib/geometry';

// Caliper pills on the image (Stav, 17 Oct; drawn in components/review/Overlay.jsx). Returns [{ key, label, x, y, w, h }] in image px.
export function calipers(draft, sp, scale, fs) {
  const poly = draft.key_contour_px || [];
  const place = (k, s, pick, prefix) => {
    const mm = lenMm(s, sp || [1, 1]);
    if (mm == null) return null;
    const end = s[pick], other = s[1 - pick];
    const len = Math.hypot(end[0] - other[0], end[1] - other[1]) || 1;
    const u = [(end[0] - other[0]) / len, (end[1] - other[1]) / len];
    const label = `${prefix} ${mm.toFixed(1)} mm`;
    const w = label.length * fs * 0.62 + 12 / scale, h = fs + 6 / scale, gap = 6 / scale;
    const beyond = Math.max(0, ...poly.map((q) => (q[0] - end[0]) * u[0] + (q[1] - end[1]) * u[1]));
    const half = Math.abs(u[0]) * (w / 2) + Math.abs(u[1]) * (h / 2);
    return { key: k, label, x: end[0] + u[0] * (beyond + gap + half), y: end[1] + u[1] * (beyond + gap + half), w, h };
  };
  const overlap = (a, b) => a && b && Math.abs(a.x - b.x) * 2 < a.w + b.w + 2 / scale && Math.abs(a.y - b.y) * 2 < a.h + b.h + 2 / scale;
  const L = draft.long_axis_px, S = draft.short_axis_px;
  const lp = L?.length === 2 ? place('long_axis_px', L, L[0][0] >= L[1][0] ? 0 : 1, 'L') : null;
  let spill = null;
  if (S?.length === 2) {
    const pick = S[0][1] >= S[1][1] ? 0 : 1;
    spill = place('short_axis_px', S, pick, 'S');
    if (overlap(lp, spill)) spill = place('short_axis_px', S, 1 - pick, 'S');
  }
  return [lp, spill].filter(Boolean);
}
