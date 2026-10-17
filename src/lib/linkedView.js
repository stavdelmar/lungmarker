// Side-by-side prior (Stav, 17 Oct): both panes open centred on their own nodule at the same zoom, and stay locked
// while scrolling, panning and zooming. Pure functions (tested in tests/review/linkedView.test.mjs).
//
// Shared state ("link"):
//   k = screen pixels per millimetre (same physical zoom in both panes, even if pixel spacing differs)
//   o = [x, y] screen offset of the nodule from the pane centre (0, 0 = nodule centred)
// Each pane turns the link into its Viewer's own zoom / pan:
//   image scale s = k · spacing (screen px per image px); Viewer zoom = s / fit;
//   a point p is drawn at (p − size / 2) · s + pan from the pane centre → pan = o − (c − size / 2) · s.
// Registration: the engine exports no transform, only the matched pair, so the two scans are aligned on the pair
// itself (prior nodule ↔ current nodule): same centre, same mm scale, slices matched by their mm distance from each
// nodule's key slice.

export const centreOf = (box) => (box ? [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2] : null);
const mmPerPx = (sp) => (Array.isArray(sp) ? (sp[1] || sp[0] || 1) : sp || 1); // x spacing (columns)

// Opening zoom: the larger of the two nodules spans about a quarter of the smaller pane.
export function initialLink({ boxes, sps, panes, maxZoom = 12, fits }) {
  const sizes = boxes.map((b, i) => (b ? Math.max(b[2] - b[0], b[3] - b[1], 4) * mmPerPx(sps[i]) : null)).filter(Boolean);
  const sizeMm = sizes.length ? Math.max(...sizes) : 20;
  const dim = Math.min(...panes.map((p) => Math.min(p.w, p.h)).filter((v) => v > 0)) || 400;
  let k = (0.25 * dim) / sizeMm;
  // keep both panes inside their zoom range (1 … maxZoom of their own fit)
  const lo = Math.max(...fits.map((f, i) => (f / mmPerPx(sps[i])) * 1));
  const hi = Math.min(...fits.map((f, i) => (f / mmPerPx(sps[i])) * maxZoom));
  k = Math.min(hi, Math.max(lo, k));
  return { k, o: [0, 0] };
}

// Link → this pane's Viewer zoom and pan.
export function paneView(link, { box, sp, cols, rows, fit }) {
  const s = link.k * mmPerPx(sp);
  const c = centreOf(box) || [cols / 2, rows / 2];
  return { zoom: s / fit, pan: { x: link.o[0] - (c[0] - cols / 2) * s, y: link.o[1] - (c[1] - rows / 2) * s } };
}

// This pane's new Viewer zoom / pan (after the user zoomed or panned it) → the shared link.
export function linkFromPane({ zoom, pan }, { box, sp, cols, rows, fit }) {
  const s = zoom * fit;
  const c = centreOf(box) || [cols / 2, rows / 2];
  return { k: s / mmPerPx(sp), o: [pan.x + (c[0] - cols / 2) * s, pan.y + (c[1] - rows / 2) * s] };
}

// Prior slice for current slice z: the same distance in mm from each nodule's key slice (falls back to slice index).
export function priorSlice(z, { selZ, pnZ, curSlices, priSlices, nPrior }) {
  const pos = (sl, zz) => sl?.find((s) => s.z === zz)?.z_position_mm;
  const cz = pos(curSlices, z), cKey = pos(curSlices, selZ), pKey = pos(priSlices, pnZ);
  let pz;
  if (cz != null && cKey != null && pKey != null && priSlices?.length) {
    const target = pKey + (cz - cKey);
    pz = priSlices.reduce((best, s) => (Math.abs(s.z_position_mm - target) < Math.abs(best.z_position_mm - target) ? s : best)).z;
  } else pz = (pnZ ?? 0) + (z - (selZ ?? z));
  return Math.max(0, Math.min((nPrior || 1) - 1, pz));
}
