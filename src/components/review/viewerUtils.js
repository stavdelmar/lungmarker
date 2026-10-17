export { lenMm } from '@/lib/geometry';
export const fmtMaybe = (v) => (v == null ? '—' : Number(v).toFixed(1));

// Bounding box of a nodule's key-slice outline (or its axes), in image pixels.
export function boxOf(n) {
  const pts = [...(n?.key_contour_px || []), ...(n?.long_axis_px || []), ...(n?.short_axis_px || [])];
  if (!pts.length) return null;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}