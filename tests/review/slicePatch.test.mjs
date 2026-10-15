// What gets saved when Daniel erases / draws on a slice, with no engine. Run:
// node --import ./tests/export/register.mjs tests/review/slicePatch.test.mjs
import { slicePatch, polyAreaMm2, axesFromOutline } from '@/lib/geometry';
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

// 4) A nodule the AI missed, drawn by hand on 3 slices (no engine at all).
let man = { source: 'Added by reviewer', key_slice_z: 50, key_contour_px: lassoToPoly(circle(100, 100, 5, 60)), contour_edits: {}, volume_mm3: null };
man = { ...man, ...slicePatch(man, 50, man.key_contour_px, { sp: SP, dz: DZ, engineContours: {}, slices }) };
const v1 = man.volume_mm3;
man = { ...man, ...slicePatch(man, 51, lassoToPoly(circle(100, 100, 8, 60)), { sp: SP, dz: DZ, engineContours: {}, slices }) };
check('Hand-drawn nodule: key slice moves to where it is largest', man.key_slice_z === 51 && man.slice_number === 52, `key slice z=${man.key_slice_z}, Slice # ${man.slice_number}`);
man = { ...man, ...slicePatch(man, 52, lassoToPoly(circle(100, 100, 5, 60)), { sp: SP, dz: DZ, engineContours: {}, slices }) };
const expectV = Math.round((Math.PI * 25 * 2 + Math.PI * 64) * 0.49 * DZ);
check('Hand-drawn nodule: volume = sum of drawn slices × slice gap (±8%)', Math.abs(man.volume_mm3 - expectV) / expectV < 0.08, `${v1} → ${man.volume_mm3} mm³ (circle maths: ${expectV})`);
check('Hand-drawn nodule: axes from its largest slice (2×8 px×0.7 = 11.2 mm ± 0.8)', Math.abs(man.long_axis_mm - 11.2) <= 0.8, `long ${man.long_axis_mm} × short ${man.short_axis_mm} mm`);

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
