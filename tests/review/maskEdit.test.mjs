// Erase / draw without an engine. Run: node --import ./tests/export/register.mjs tests/review/maskEdit.test.mjs
import { brushEdit, lassoToPoly } from '@/lib/maskEdit';
import { axesFromOutline, polyAreaMm2 } from '@/lib/geometry';

const SP = [1, 1]; // 1 mm pixels so px = mm
const circle = (cx, cy, r, n = 48) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)]);
let fails = 0;
const check = (name, ok, ev) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(58)} │ ${ev}`); if (!ok) fails++; };

// Nodule r = 10 mm with a 3 mm-wide vessel tail running right to x = 140 (the tail makes the long axis too long).
const body = circle(100, 100, 10).filter(([x, y]) => !(x > 105 && Math.abs(y - 100) < 1.5));
const withTail = [...body.filter(([x, y]) => y < 100 || x <= 105), [109.8, 98.5], [140, 98.5], [140, 101.5], [109.8, 101.5], ...body.filter(([x, y]) => y >= 100 && x > 105)];
const tailPoly = (() => { // a clean ordered outline: circle with a bump
  const pts = [];
  for (let i = 0; i < 64; i++) {
    const t = (2 * Math.PI * i) / 64, x = 100 + 10 * Math.cos(t), y = 100 + 10 * Math.sin(t);
    if (i === 0) { pts.push([109.9, 98.5], [140, 98.5], [140, 101.5], [109.9, 101.5]); continue; }
    if (Math.abs(y - 100) < 1.6 && x > 105) continue;
    pts.push([x, y]);
  }
  return pts;
})();
void withTail;
const before = axesFromOutline(tailPoly, SP);
check('Outline with vessel tail: long axis is too long', before.long_axis_mm > 35 && polyAreaMm2(tailPoly, SP) > 314, `long ${before.long_axis_mm} mm, area ${polyAreaMm2(tailPoly, SP).toFixed(0)} mm²`);

// Cutting further out: everything past the cut goes, the stub still attached to the nodule stays.
const far = brushEdit(tailPoly, [[120, 92], [120, 108]], 2, 'erase');
check('Cut far out on the tail: far part gone, attached stub stays', Math.max(...far.map((p) => p[0])) < 119 && Math.max(...far.map((p) => p[0])) > 115, `rightmost x = ${Math.max(...far.map((p) => p[0])).toFixed(1)}`);
// Daniel drags the eraser once across the base of the tail, at the nodule edge (brush radius 2 mm).
const t0 = performance.now();
const cut = brushEdit(tailPoly, [[111.5, 94], [111.5, 106]], 2, 'erase');
const ms = performance.now() - t0;
const after = axesFromOutline(cut, SP);
check('One stroke across the base of the tail removes the whole tail', Math.max(...cut.map((p) => p[0])) < 111, `rightmost point x = ${Math.max(...cut.map((p) => p[0])).toFixed(1)} (tail went to 140)`);
check('Long axis back to the nodule size (20 mm ± 1)', Math.abs(after.long_axis_mm - 20) <= 1, `long ${after.long_axis_mm} × short ${after.short_axis_mm} mm`);
check('Area back to the circle (π·10² = 314 mm² ± 6%; brush nicks the edge)', Math.abs(polyAreaMm2(cut, SP) - 314) / 314 < 0.06, `area ${polyAreaMm2(cut, SP).toFixed(0)} mm²`);
check('Fast enough to feel instant (< 50 ms)', ms < 50, `${ms.toFixed(1)} ms, ${cut.length} outline points`);

// Erasing a bite out of the edge (not separating anything) keeps the rest, smaller.
const bite = brushEdit(circle(100, 100, 10), [[110, 95], [110, 105]], 3, 'erase');
check('Erasing a bite out of the edge shrinks it, keeps one piece', polyAreaMm2(bite, SP) < 300 && polyAreaMm2(bite, SP) > 200, `area 314 → ${polyAreaMm2(bite, SP).toFixed(0)} mm²`);
// Shift-drag paints back.
const back = brushEdit(bite, [[110, 95], [110, 105]], 3, 'paint');
check('Shift + drag paints the bite back (brush adds a little bulge)', polyAreaMm2(back, SP) > 300, `area → ${polyAreaMm2(back, SP).toFixed(0)} mm²`);
// Erasing everything leaves nothing.
const gone = brushEdit(circle(100, 100, 3), [[95, 100], [105, 100]], 6, 'erase');
check('Erasing the whole outline leaves no outline', gone.length === 0, `${gone.length} points`);

// Draw (lasso): a hand-drawn wobbly loop becomes a clean outline.
const lasso = Array.from({ length: 80 }, (_, i) => { const t = (2 * Math.PI * i) / 80, r = 6 + 0.4 * Math.sin(7 * t); return [200 + r * Math.cos(t), 150 + r * Math.sin(t)]; });
const drawn = lassoToPoly(lasso);
const da = axesFromOutline(drawn, SP);
check('Drawn outline (lasso) → clean polygon with axes', drawn.length >= 8 && Math.abs(da.long_axis_mm - 12.5) < 1.2, `${drawn.length} points, long ${da.long_axis_mm} × short ${da.short_axis_mm} mm`);
check('A tiny scribble is not taken as an outline', lassoToPoly([[1, 1], [2, 1], [2, 2], [1, 2], [1, 1], [2, 2]]) === null, 'ignored');

console.log(fails ? `\n${fails} failed` : '\nall pass');
process.exit(fails ? 1 : 0);
