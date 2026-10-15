// What gets saved when Daniel erases / draws on a slice, with no engine. Run:
// node --import ./tests/export/register.mjs tests/review/slicePatch.test.mjs
import { slicePatch, polyAreaMm2, axesFromOutline, interpolateSlices, drawnSlices } from '@/lib/geometry';
import { brushEdit, lassoToPoly } from '@/lib/maskEdit';
import { saveNodule } from '@/lib/edits';
import { base44 } from '@/api/base44Client';

const SP = [0.7, 0.7], DZ = 1.25; // mm per pixel, mm between slices
let fails = 0;
const check = (name, ok, ev) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(62)} │ ${ev}`); if (!ok) fails++; };
const circle = (cx, cy, r, n = 40) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)].map((v) => Math.round(v * 10) / 10));
const withTail = (cx, cy, r, len) => { // circle + 4 px wide tail to the right
  const c = circle(cx, cy, r, 64).filter(([x, y]) => !(x > cx + r * 0.9 && Math.abs(y - cy) < 2.2));
  const i = c.findIndex(([, y]) => y > cy); // first point below the centre line
  return [...c.slice(i), ...c.slice(0, i)].reduce((acc, p, k, arr) => (k === arr.length - 1 ? [...acc, p, [cx + r - 0.3, cy - 2], [cx + r + len, cy - 2], [cx + r + len, cy + 2], [cx + r - 0.3, cy + 2]] : [...acc, p]), []);
};
const slices = Array.from({ length: 300 }, (_, z) => ({ z, slice_number: z + 1 }));

// AI nodule on slices 98–102 (radius 12 px = 8.4 mm at the key slice 100), with a vessel tail on 100 and 101.
const eng = { 98: [circle(200, 200, 7)], 99: [circle(200, 200, 10)], 100: [withTail(200, 200, 12, 20)], 101: [withTail(200, 200, 10, 20)], 102: [circle(200, 200, 6)] };
const engVol = Math.round(Object.values(eng).reduce((s, p) => s + polyAreaMm2(p[0], SP), 0) * DZ);
const ai = { source: 'AI', key_slice_z: 100, key_contour_px: eng[100][0], contour_edits: {}, volume_mm3: engVol, ...axesFromOutline(eng[100][0], SP) };
check('AI draft: tail makes the long axis too long', ai.long_axis_mm > 25, `long ${ai.long_axis_mm} × short ${ai.short_axis_mm} mm, volume ${engVol} mm³`);

// 1) Erase the tail on the key slice: one stroke at its base.
const cutKey = brushEdit(ai.key_contour_px, [[213, 194], [213, 206]], 2.5, 'erase');
const p1 = slicePatch(ai, 100, cutKey, { sp: SP, dz: DZ, engineContours: eng, slices });
const tailArea100 = polyAreaMm2(eng[100][0], SP) - polyAreaMm2(cutKey, SP);
check('Key slice erase: long axis back to ~2×radius (16.8 mm ± 1)', Math.abs(p1.long_axis_mm - 16.8) <= 1, `long ${ai.long_axis_mm} → ${p1.long_axis_mm} mm, short ${p1.short_axis_mm} mm`);
check('Key slice erase: volume drops by the erased area × slice gap', Math.abs((engVol - p1.volume_mm3) - tailArea100 * DZ) <= 1, `${engVol} → ${p1.volume_mm3} mm³ (−${(tailArea100 * DZ).toFixed(0)})`);
const ai1 = { ...ai, ...p1 };

// 2) Scroll to slice 101, erase the tail there too (a non-key slice).
const cut101 = brushEdit(eng[101][0], [[211, 194], [211, 206]], 2.5, 'erase');
const p2 = slicePatch(ai1, 101, cut101, { sp: SP, dz: DZ, engineContours: eng, slices });
check('Other-slice erase: saved as that slice\'s outline, key + axes untouched', p2.contour_edits?.['101']?.length > 2 && !('key_contour_px' in p2) && !('long_axis_mm' in p2), `edited slices: ${Object.keys(p2.contour_edits).join(', ')}`);
check('Other-slice erase: volume drops again', p2.volume_mm3 < p1.volume_mm3, `${p1.volume_mm3} → ${p2.volume_mm3} mm³`);
const ai2 = { ...ai1, ...p2 };

// 3) Erase the whole outline on slice 102 (not nodule there): that slice's share goes.
const p3 = slicePatch(ai2, 102, [], { sp: SP, dz: DZ, engineContours: eng, slices });
check('Erasing a whole slice removes its share of the volume', Math.abs((p2.volume_mm3 - p3.volume_mm3) - polyAreaMm2(eng[102][0], SP) * DZ) <= 1, `${p2.volume_mm3} → ${p3.volume_mm3} mm³`);

// 4) A nodule the AI missed. Default: 4 clicks → axes only, no outline, Volume empty.
const clicked = { source: 'Added by reviewer', key_slice_z: 50, key_contour_px: [], contour_edits: {}, volume_mm3: null, long_axis_mm: 8.4, short_axis_mm: 8.4 };
check('Added by 4 clicks: axes only, Volume empty', clicked.volume_mm3 === null && !clicked.key_contour_px.length, `long ${clicked.long_axis_mm} × short ${clicked.short_axis_mm} mm, volume (empty)`);
// One outline alone gives no volume (top and bottom are unknown).
const one = { ...clicked, ...slicePatch(clicked, 50, lassoToPoly(circle(100, 100, 6, 60)), { sp: SP, dz: DZ, engineContours: {}, slices }) };
check('One outlined slice: still no volume', one.volume_mm3 === null, 'volume (empty)');

// Option for volume: outline top, middle and bottom; the slices between are filled in.
// Ground truth = the same nodule outlined on EVERY slice (what Daniel did by hand before).
const R = 6, kMax = Math.floor((R - 0.01) / DZ); // sphere radius 6 mm → slices −4…+4 around the middle
const rad = (k) => Math.sqrt(R * R - (k * DZ) ** 2) / SP[0]; // px
const sphereSlice = (k) => lassoToPoly(circle(100, 100, rad(k), 72));
let full = { ...clicked }; for (let k = -kMax; k <= kMax; k++) full = { ...full, ...slicePatch(full, 60 + k, sphereSlice(k), { sp: SP, dz: DZ, engineContours: {}, slices }) };
let three = { ...clicked }; for (const k of [-kMax, 0, kMax]) three = { ...three, ...slicePatch(three, 60 + k, sphereSlice(k), { sp: SP, dz: DZ, engineContours: {}, slices }) };
const trueV = (4 / 3) * Math.PI * R ** 3;
check(`Sphere, 3 slices outlined vs all ${2 * kMax + 1} outlined: within 5%`, Math.abs(three.volume_mm3 - full.volume_mm3) / full.volume_mm3 < 0.05, `3 slices ${three.volume_mm3} mm³ vs every slice ${full.volume_mm3} mm³ (true sphere ${trueV.toFixed(0)})`);
check('Key slice = the middle (largest) one, Slice # set', three.key_slice_z === 60 && three.slice_number === 61, `z=${three.key_slice_z}, Slice # ${three.slice_number}`);
const filled = interpolateSlices(drawnSlices(three), SP).filled;
check('Slices in between are filled in (shown dashed)', filled.size === 2 * kMax - 2, `${filled.size} filled: ${[...filled].join(', ')}`);
// Straight-line radius interpolation would have badly undercounted a round nodule; show the size of that error.
const naive = (() => { let v = 0; for (let k = -kMax; k <= kMax; k++) { const t = Math.abs(k) / kMax; const r = rad(0) + (rad(kMax) - rad(0)) * t; v += Math.PI * (r * SP[0]) ** 2 * DZ; } return Math.round(v); })();
check('(For comparison) a straight-line fill would undercount', naive < three.volume_mm3 * 0.9, `straight-line fill ${naive} mm³ vs curve ${three.volume_mm3} mm³`);

// Only top + bottom of a big nodule: the middle is unknown → no volume (would be far too small).
let tb = { ...clicked }; for (const k of [-kMax, kMax]) tb = { ...tb, ...slicePatch(tb, 60 + k, sphereSlice(k), { sp: SP, dz: DZ, engineContours: {}, slices }) };
check('Top + bottom only (middle missing): no volume, asks for the middle', tb.volume_mm3 === null, 'volume (empty)');
// A small nodule on 2 neighbouring slices: fine.
let small = { ...clicked }; for (const k of [0, 1]) small = { ...small, ...slicePatch(small, 90 + k, lassoToPoly(circle(100, 100, 4, 60)), { sp: SP, dz: DZ, engineContours: {}, slices }) };
check('Small nodule on 2 neighbouring slices: volume', small.volume_mm3 > 0, `${small.volume_mm3} mm³`);
// Elongated (ellipsoid) nodule.
const ell = (k) => lassoToPoly(Array.from({ length: 72 }, (_, i) => { const t = (2 * Math.PI * i) / 72, f = Math.sqrt(Math.max(0, 1 - ((k * DZ) / 5) ** 2)); return [100 + (9 / 0.7) * f * Math.cos(t), 100 + (5 / 0.7) * f * Math.sin(t)]; }));
let eFull = { ...clicked }; for (let k = -3; k <= 3; k++) eFull = { ...eFull, ...slicePatch(eFull, 80 + k, ell(k), { sp: SP, dz: DZ, engineContours: {}, slices }) };
let eThree = { ...clicked }; for (const k of [-3, 0, 3]) eThree = { ...eThree, ...slicePatch(eThree, 80 + k, ell(k), { sp: SP, dz: DZ, engineContours: {}, slices }) };
check('Elongated nodule, 3 slices vs every slice: within 5%', Math.abs(eThree.volume_mm3 - eFull.volume_mm3) / eFull.volume_mm3 < 0.05, `${eThree.volume_mm3} vs ${eFull.volume_mm3} mm³; axes ${eThree.long_axis_mm} × ${eThree.short_axis_mm} mm`);

// 5) Through the app's save: editing another slice of a confirmed outline un-confirms it, and is in the trail.
const scan = await base44.entities.Scan.create({ engine_scan_id: 'T', patient_id: 'T' });
const rec = await base44.entities.Nodule.create({ scan: scan.id, nodule_label: 'N1', ...ai1, outline_confirmed: true, outline_confirmed_by_initials: 'DR', ai_draft: {} });
await saveNodule(scan, rec, p2, { user: { email: 'd@x' }, initials: 'DR' }, { source: 'brush: erased' });
const after = await base44.entities.Nodule.get(rec.id);
const ev = (await base44.entities.EditEvent.filter({ nodule: rec.id })).items.find((e) => e.field === 'outline');
check('Editing any slice un-confirms the outline (Daniel re-confirms)', after.outline_confirmed === false, `outline_confirmed: true → ${after.outline_confirmed}`);
check('Edit trail records it as an outline change with how it was made', !!ev && /brush: erased/.test(ev.new_value), ev ? `${ev.old_value} → ${ev.new_value}` : 'no event');

console.log(fails ? `\n${fails} failed` : '\nall pass');
process.exit(fails ? 1 : 0);
