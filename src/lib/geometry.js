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
  if (!dz) return oldVolume ?? null;
  if (oldVolume != null) {
    const v = Number(oldVolume) + (polyAreaMm2(newPoly, sp) - polyAreaMm2(oldPoly, sp)) * dz;
    return v > 0 ? Math.round(v) : null;
  }
  return volumeFromContours(contoursByZ, sp, dz, keyZ, newPoly);
}

// The outline of nodule n on slice z: key slice → key_contour_px; a slice Daniel edited → his outline;
// otherwise the engine's outline for that slice (if any).
export function sliceContour(n, z, engineContours) {
  if (!n) return [];
  if (z === n.key_slice_z) return n.key_contour_px || [];
  const ed = n.contour_edits || {};
  if (Object.prototype.hasOwnProperty.call(ed, String(z))) return ed[String(z)] || [];
  return largestPoly(engineContours?.[String(z)]);
}

// Every slice's outline for nodule n, with Daniel's edits applied ({"z": [poly]}).
export function allSliceContours(n, engineContours) {
  const out = {};
  Object.entries(engineContours || {}).forEach(([z, polys]) => { out[z] = [largestPoly(polys)]; });
  Object.entries(n.contour_edits || {}).forEach(([z, poly]) => { out[z] = [poly || []]; });
  if (n.key_contour_px?.length > 2) out[String(n.key_slice_z)] = [n.key_contour_px];
  return out;
}

// Slices that currently have an outline.
export const outlinedSlices = (n, engineContours) => Object.entries(allSliceContours(n, engineContours)).filter(([, p]) => (p[0] || []).length > 2).map(([z]) => Number(z));

// What to save when Daniel replaces nodule n's outline on slice zz (erase / paint / draw), with no engine:
// the slice outline, axes from the key slice, and the volume. AI nodules keep the engine's volume for the
// other slices and swap this slice's share; hand-drawn nodules sum Daniel's slices, and their key slice
// moves to the slice where they are largest.
export function slicePatch(n, zz, newPoly, { sp, dz, engineContours, slices }) {
  const oldPoly = sliceContour(n, zz, engineContours);
  const patch = {};
  if (zz === n.key_slice_z) patch.key_contour_px = newPoly;
  else patch.contour_edits = { ...(n.contour_edits || {}), [String(zz)]: newPoly };
  if (n.source !== 'AI') {
    const all = allSliceContours({ ...n, ...patch }, engineContours);
    const [kz] = Object.entries(all).map(([k, p]) => [Number(k), polyAreaMm2(p[0], sp)]).sort((a, b) => b[1] - a[1])[0] || [n.key_slice_z];
    if (kz !== n.key_slice_z && all[String(kz)]) {
      const edits = Object.fromEntries(Object.entries(all).filter(([k]) => Number(k) !== kz).map(([k, p]) => [k, p[0]]));
      Object.assign(patch, { key_slice_z: kz, slice_number: slices?.find((s) => s.z === kz)?.slice_number ?? kz + 1, key_contour_px: all[String(kz)][0], contour_edits: edits });
    }
    patch.volume_mm3 = volumeFromContours(all, sp, dz);
  } else {
    patch.volume_mm3 = volumeAfterKeyEdit({ oldVolume: n.volume_mm3, oldPoly, newPoly, sp, dz, contoursByZ: allSliceContours(n, engineContours), keyZ: zz });
  }
  if ('key_contour_px' in patch && patch.key_contour_px?.length > 2) Object.assign(patch, axesFromOutline(patch.key_contour_px, sp));
  patch.volume_stale = false;
  return patch;
}
