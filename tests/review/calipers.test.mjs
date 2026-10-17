// Caliper labels: "L …" / "S …" pills outside the outline, never on top of each other or of the outline points.
import { calipers } from '@/lib/calipers';
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };
const inside = (p, c) => Math.abs(p[0] - c.x) <= c.w / 2 && Math.abs(p[1] - c.y) <= c.h / 2;
const overlap = (a, b) => Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;
const check = (name, d, sp, scale) => {
  const cs = calipers(d, sp, scale, 12 / scale);
  const L = cs.find((c) => c.key === 'long_axis_px'), S = cs.find((c) => c.key === 'short_axis_px');
  ok(L?.label.startsWith('L ') && S?.label.startsWith('S '), `${name}: labels "${L?.label}" / "${S?.label}"`);
  ok(!overlap(L, S), `${name}: the two pills don't overlap`);
  const pts = [...d.key_contour_px, ...d.long_axis_px, ...d.short_axis_px];
  ok(!cs.some((c) => pts.some((p) => inside(p, c))), `${name}: no outline point or axis end under a pill`);
  return cs;
};
// Stav's screenshot: a small irregular nodule (~7 mm) with crossing axes, viewed zoomed in
const n2 = { key_contour_px: [[101, 100], [105, 100], [111, 100], [114, 103], [115, 107], [113, 111], [107, 115], [102, 110], [99, 105], [98, 102]],
  long_axis_px: [[111, 100], [107, 115]], short_axis_px: [[98, 104], [113, 109]] };
check('small nodule, zoom 6', n2, [0.7, 0.7], 6);
check('small nodule, zoom 2', n2, [0.7, 0.7], 2);
// round 30 mm nodule, axes horizontal / vertical
const circle = Array.from({ length: 24 }, (_, i) => [140 + 22 * Math.cos(i / 24 * 6.2832), 150 + 22 * Math.sin(i / 24 * 6.2832)]);
check('round nodule', { key_contour_px: circle, long_axis_px: [[118, 150], [162, 150]], short_axis_px: [[140, 131], [140, 169]] }, [0.7, 0.7], 2.5);
// both axes pointing the same way at their chosen ends (nearly parallel) → the short pill must move to its other end
const thin = { key_contour_px: [[100, 100], [140, 104], [141, 108], [100, 106]], long_axis_px: [[100, 103], [141, 106]], short_axis_px: [[120, 101], [140, 107.5]] };
const cs = check('near-parallel axes', thin, [0.7, 0.7], 3);
const S = cs.find((c) => c.key === 'short_axis_px');
ok(S.x < 130, `near-parallel: short pill moved to its other (left) end (x ${S.x.toFixed(1)})`);
console.log(fail ? `${fail} failed` : 'all pass');
