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
    ...(f.solid_component_mm != null ? { solid_component_mm: r1(f.solid_component_mm) } : {}),
  };
}
// ---- Volume after a hand edit (browser side) ----
// Area of a polygon in mm² (shoelace). sp = [row_mm, col_mm].
export function polyAreaMm2(poly, sp) {
  if (!poly || poly.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = toMm(poly[i], sp), [x2, y2] = toMm(poly[(i + 1) % poly.length], sp);
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

// Distance between slices in mm: from the slice positions if the engine gives them, else the slice thickness.
export function sliceStepMm(meta, fallback) {
  const zs = (meta?.slices || []).map((s) => s.z_position_mm).filter((v) => v != null);
  const d = zs.slice(1).map((v, i) => Math.abs(v - zs[i])).filter((v) => v > 0).sort((a, b) => a - b);
  return d.length ? d[Math.floor(d.length / 2)] : Number(fallback) || null;
}

// Volume from per-slice outlines: sum of slice areas × slice step. contoursByZ = {"z": [[poly], ...]}.
export function volumeFromContours(contoursByZ, sp, dz, keyZ, keyPoly) {
  if (!dz) return null;
  const byZ = { ...(contoursByZ || {}) };
  if (keyPoly?.length > 2) byZ[String(keyZ)] = [keyPoly];
  const total = Object.values(byZ).reduce((sum, polys) => sum + polyAreaMm2(largestPoly(polys), sp), 0);
  return total > 0 ? Math.round(total * dz) : null;
}

// New volume after Daniel moves outline points on the key slice: keep the engine's volume for every other
// slice and swap the key slice's share (old area → new area) × slice step. If there is no volume yet,
// rebuild it from the per-slice outlines. Returns null only if there is nothing to measure from.
export function volumeAfterKeyEdit({ oldVolume, oldPoly, newPoly, sp, dz, contoursByZ, keyZ }) {
  if (!dz || !newPoly || newPoly.length < 3) return oldVolume ?? null;
  if (oldVolume != null && polyAreaMm2(oldPoly, sp) > 0)
    return Math.max(1, Math.round(Number(oldVolume) + (polyAreaMm2(newPoly, sp) - polyAreaMm2(oldPoly, sp)) * dz));
  return volumeFromContours(contoursByZ, sp, dz, keyZ, newPoly);
}
