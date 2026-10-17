// Add / delete outline points (Stav, 17 Oct): geometry + the save path (axes and volume recomputed, trail, undo-able).
import { base44 } from '@/api/base44Client';
import { insertPoint, deletePoint, nearestEdge, MIN_POINTS } from '@/lib/pointEdit';
import { slicePatch } from '@/lib/geometry';
import { saveNodule } from '@/lib/edits';
const { Scan, Nodule, EditEvent } = base44.entities;
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };
const sq = [[0, 0], [20, 0], [20, 10], [0, 10]]; // 20 × 10 px rectangle

// geometry
const e = nearestEdge(sq, [7.2, 0.6]);
ok(e.i === 0 && e.dist < 1, `click near the top edge → edge 0 (got ${e.i}, ${e.dist.toFixed(2)})`);
const ins = insertPoint(sq, e.i, [7.2, 0.6]);
ok(ins && ins.idx === 1 && JSON.stringify(ins.poly[1]) === '[7.2,0]', `new point snapped onto the edge at [7.2,0] (got ${JSON.stringify(ins?.poly[1])})`);
ok(ins.poly.length === 5 && JSON.stringify(ins.poly.filter((_, j) => j !== 1)) === JSON.stringify(sq), 'other points unchanged, order kept');
const closing = insertPoint(sq, 3, [-1, 5]); // edge 3 = last point back to the first
ok(closing && closing.idx === 4 && JSON.stringify(closing.poly[4]) === '[0,5]', `closing edge works (got ${JSON.stringify(closing?.poly)})`);
ok(insertPoint(sq, 0, [-3, 0]) === null, 'a click on an existing corner adds nothing');
ok(JSON.stringify(deletePoint(ins.poly, 1)) === JSON.stringify(sq), 'delete the new point → back to the rectangle');
ok(deletePoint(sq, 0)?.length === 3, 'delete a corner → 3 points');
ok(deletePoint([[0, 0], [5, 0], [0, 5]], 0) === null, `never below ${MIN_POINTS} points`);

// save path: same as dragging (slicePatch → saveNodule): axes + volume follow, one trail row with the source
const sp = [0.7, 0.7], dz = 1.25;
const scan = await Scan.create({ engine_scan_id: 'S', patient_id: 'P', timepoint: 'Baseline', review_status: 'In review' });
const n = await Nodule.create({ scan: scan.id, nodule_label: 'N1', source: 'AI', status: 'Pending', key_slice_z: 5, slice_number: 6, key_contour_px: sq, outline_confirmed: true,
  long_axis_mm: 15.7, short_axis_mm: 7, volume_mm3: 500, ai_draft: { volume: 500, contour: sq, long: 15.7, short: 7 } });
const before = { ...n };
// a dent: add a point on the bottom edge and pull it in (add, then the drag moves it)
const add = insertPoint(sq, 2, [10, 10.4]);
const dented = add.poly.map((p, j) => (j === add.idx ? [10, 4] : p));
const patch = slicePatch(n, 5, dented, { sp, dz, engineContours: { 5: [sq] }, slices: [{ z: 5, slice_number: 6 }] });
ok(patch.volume_mm3 < 500, `volume recomputed (500 → ${patch.volume_mm3})`);
ok(patch.short_axis_mm != null && patch.long_axis_mm != null, `axes recomputed (${patch.long_axis_mm} × ${patch.short_axis_mm} mm)`);
await saveNodule(scan, n, patch, { user: { email: 's@x' }, initials: 'SD' }, { source: 'point added by hand' });
const rows = (await EditEvent.filter({ nodule: n.id })).items;
const outline = rows.find((r) => r.field === 'outline');
ok(outline?.source === 'point added by hand' && /5 points, point added by hand/.test(outline.new_value), `trail: outline row "${outline?.new_value}" (${outline?.source})`);
ok(rows.some((r) => r.field === 'outline_confirmed' && r.new_value === 'false'), 'outline un-confirmed by the edit');
// undo = save the previous fields back (what the page's Undo does)
await saveNodule(scan, await Nodule.get(n.id), { key_contour_px: before.key_contour_px, volume_mm3: before.volume_mm3, long_axis_mm: before.long_axis_mm, short_axis_mm: before.short_axis_mm }, { user: { email: 's@x' }, initials: 'SD' }, { source: 'undo' });
const back = await Nodule.get(n.id);
ok(back.key_contour_px.length === 4 && back.volume_mm3 === 500, 'undo restores the 4-point outline and the volume');
console.log(fail ? `${fail} failed` : 'all pass');
