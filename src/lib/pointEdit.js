// Add / delete single outline points on the key slice (Stav, 17 Oct). Pure functions; the page saves the result
// through the same path as dragging points (axes + volume recomputed, Edit trail, Undo).
export const MIN_POINTS = 3;

// The point on segment a→b closest to p.
function project(a, b, p) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
  return [a[0] + t * dx, a[1] + t * dy];
}
const r1 = (v) => Math.round(v * 10) / 10;

// Nearest edge of a closed polygon to p: { i, at, dist } — the edge runs from poly[i] to poly[(i + 1) % n].
export function nearestEdge(poly, p) {
  let best = null;
  poly.forEach((a, i) => {
    const at = project(a, poly[(i + 1) % poly.length], p);
    const dist = Math.hypot(at[0] - p[0], at[1] - p[1]);
    if (!best || dist < best.dist) best = { i, at, dist };
  });
  return best;
}

// New point on edge i (between poly[i] and poly[i+1]), placed where the click was, snapped onto the edge.
// Returns { poly, idx } (idx = the new point's index) — or null if the click lands on an existing point.
export function insertPoint(poly, i, p) {
  const n = poly.length, a = poly[i], b = poly[(i + 1) % n];
  const at = project(a, b, p).map(r1);
  if ((at[0] === a[0] && at[1] === a[1]) || (at[0] === b[0] && at[1] === b[1])) return null;
  const out = [...poly.slice(0, i + 1), at, ...poly.slice(i + 1)];
  return { poly: out, idx: i + 1 };
}

// Remove point idx. Returns null when the outline would drop below MIN_POINTS.
export function deletePoint(poly, idx) {
  if (poly.length <= MIN_POINTS || idx < 0 || idx >= poly.length) return null;
  return poly.filter((_, j) => j !== idx);
}
