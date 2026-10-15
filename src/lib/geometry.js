export const r1 = (v) => (v == null || v === '' || isNaN(v) ? null : Math.round(Number(v) * 10) / 10);
export const meanOf = (l, s) => (l == null || s == null ? null : r1((Number(l) + Number(s)) / 2));

// pixel_spacing_mm = [row_mm, col_mm]; x = column, y = row
const toMm = (p, sp) => [p[0] * sp[1], p[1] * sp[0]];
const toPx = (q, sp) => [r1(q[0] / sp[1]), r1(q[1] / sp[0])];

export function lenMm(seg, sp) {
  if (!seg || seg.length < 2) return null;
  const a = toMm(seg[0], sp), b = toMm(seg[1], sp);
  return r1(Math.hypot(a[0] - b[0], a[1] - b[1]));
}

export function axesFromOutline(pts, sp) {
  if (!pts || pts.length < 3) return null;
  const mm = pts.map((p) => toMm(p, sp));
  let best = 0, bi = 0, bj = 1;
  for (let i = 0; i < mm.length; i++)
    for (let j = i + 1; j < mm.length; j++) {
      const d = Math.hypot(mm[i][0] - mm[j][0], mm[i][1] - mm[j][1]);
      if (d > best) { best = d; bi = i; bj = j; }
    }
  const a = mm[bi], b = mm[bj];
  const u = [(b[0] - a[0]) / best, (b[1] - a[1]) / best];
  const v = [-u[1], u[0]];
  const c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let mn = Infinity, mx = -Infinity;
  mm.forEach((p) => {
    const t = (p[0] - c[0]) * v[0] + (p[1] - c[1]) * v[1];
    mn = Math.min(mn, t); mx = Math.max(mx, t);
  });
  return {
    long_axis_px: [pts[bi], pts[bj]],
    short_axis_px: [toPx([c[0] + v[0] * mn, c[1] + v[1] * mn], sp), toPx([c[0] + v[0] * mx, c[1] + v[1] * mx], sp)],
    long_axis_mm: r1(best),
    short_axis_mm: r1(mx - mn),
  };
}

export const largestPoly = (polys) => (polys?.length ? polys.reduce((a, b) => (b.length > a.length ? b : a)) : []);

export function normType(t = '') {
  const s = String(t).toLowerCase();
  if (s.includes('part')) return 'Part-solid';
  if (s.includes('ground') || s.includes('ggo') || s.includes('glass')) return 'Ground-glass';
  return 'Solid';
}

export function findingPatch(f, z) {
  return {
    key_contour_px: largestPoly(f.contours?.[String(z)] || f.contours?.[String(f.key_slice_z)]),
    long_axis_px: f.long_axis_px,
    short_axis_px: f.short_axis_px,
    long_axis_mm: r1(f.long_axis_mm),
    short_axis_mm: r1(f.short_axis_mm),
    volume_mm3: f.volume_mm3 == null ? null : Math.round(f.volume_mm3),
    volume_stale: false,
  };
}