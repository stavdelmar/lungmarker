// "Set as key slice" (Daniel, 18 Oct): of two near-equal slices he measures the one with the sharpest edges.
// Moving the key slice re-measures long / short / mean on the new slice and updates Slice #; every slice keeps its
// outline, so the volume and "outline confirmed" don't change. Trail: Slice # (AI key slice → new) + the axes.
// Run: node --import ./tests/export/register.mjs tests/review/keySlice.test.mjs
import { base44 } from '@/api/base44Client';
import { keySlicePatch, keySliceOptions, allSliceContours, axesFromOutline, slicePatch, meanOf } from '@/lib/geometry';
import { saveNodule } from '@/lib/edits';
import { trailRows, measurementRows } from '@/lib/exportRows';
const { Scan, Nodule, EditEvent } = base44.entities;
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };
const SP = [0.7, 0.7], DZ = 1.25;
const me = { user: { email: 'daniel@x' }, initials: 'DR' };
const slices = Array.from({ length: 300 }, (_, z) => ({ z, slice_number: z + 1 }));
const ellipse = (cx, cy, rx, ry, n = 32) => Array.from({ length: n }, (_, i) => [cx + rx * Math.cos((2 * Math.PI * i) / n), cy + ry * Math.sin((2 * Math.PI * i) / n)].map((v) => Math.round(v * 10) / 10));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sorted = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).sort(([a], [b]) => Number(a) - Number(b))));

// AI nodule on slices 173–179, AI key slice 175 (= Slice # 176). Slice 177 (# 178) is slightly smaller but sharper.
const eng = { 173: [ellipse(200, 200, 5, 4)], 174: [ellipse(200, 200, 9, 7)], 175: [ellipse(200, 200, 12, 9)], 176: [ellipse(200, 200, 11, 9)],
  177: [ellipse(200, 200, 10, 8)], 178: [ellipse(200, 200, 7, 6)], 179: [ellipse(200, 200, 4, 3)] };
const ax175 = axesFromOutline(eng[175][0], SP);
const ai = { source: 'AI', kind: 'nodule', key_slice_z: 175, slice_number: 176, key_contour_px: eng[175][0], contour_edits: {}, ...ax175, volume_mm3: 1234, outline_confirmed: true,
  ai_draft: { key_slice_z: 175, key_slice_number: 176, long: ax175.long_axis_mm, short: ax175.short_axis_mm, contour: eng[175][0], volume: 1234 } };
const opts = { sp: SP, engineContours: eng, slices };

// 1. Pure patch on an untouched AI nodule.
const p = keySlicePatch(ai, 177, opts);
const ax177 = axesFromOutline(eng[177][0], SP);
ok(p && p.key_slice_z === 177 && p.slice_number === 178, `key slice → z 177, Slice # 178 (got ${p?.key_slice_z}, ${p?.slice_number})`);
ok(same(p.key_contour_px, eng[177][0]), 'key outline = the outline on the new slice');
ok(p.long_axis_mm === ax177.long_axis_mm && p.short_axis_mm === ax177.short_axis_mm && p.mean_diameter_mm === meanOf(ax177.long_axis_mm, ax177.short_axis_mm),
  `axes re-measured on the new slice: ${ax175.long_axis_mm} × ${ax175.short_axis_mm} → ${p.long_axis_mm} × ${p.short_axis_mm}, mean ${p.mean_diameter_mm}`);
ok(p.long_axis_mm < ax175.long_axis_mm, 'the smaller slice gives a smaller long axis');
ok(!('volume_mm3' in p) && !('outline_confirmed' in p), 'volume and confirmation are not touched');
ok(sorted(allSliceContours({ ...ai, ...p }, eng, SP)) === sorted(allSliceContours(ai, eng, SP)), 'every slice keeps exactly the same outline');
ok(Object.keys(p.contour_edits).length === 0, 'untouched AI outline: no slice edits needed (old key = engine outline)');
ok(p.key_slice_manual === true, 'marked as chosen by the reviewer');

// 2. Not possible: same slice, a slice with no outline, a "not found?" item.
ok(keySlicePatch(ai, 175, opts) === null, 'same slice → nothing');
ok(keySlicePatch(ai, 190, opts) === null && keySlicePatch(ai, 172, opts) === null, 'slice outside the outline range → nothing');
ok(keySlicePatch({ ...ai, contour_edits: { 177: [] } }, 177, opts) === null, 'slice whose outline was erased → nothing');
ok(keySliceOptions({ kind: 'prior_not_found' }, eng, SP).length === 0, '"not found?" item has no key slice options');
ok(same(keySliceOptions(ai, eng, SP), [173, 174, 175, 176, 177, 178, 179]), 'AI nodule: every outlined slice is an option');

// 3. Edited outlines move with their slice: an edited key slice is kept as a slice edit; an edited target becomes the key.
const editedKey = ellipse(200, 200, 11, 8), edited177 = ellipse(201, 200, 9, 8);
const ai2 = { ...ai, key_contour_px: editedKey, contour_edits: { 177: edited177 } };
const p2 = keySlicePatch(ai2, 177, opts);
ok(same(p2.key_contour_px, edited177) && !('177' in p2.contour_edits), 'edited outline on the new slice becomes the key outline');
ok(same(p2.contour_edits['175'], editedKey), 'edited old key outline kept as a slice edit');
ok(sorted(allSliceContours({ ...ai2, ...p2 }, eng, SP)) === sorted(allSliceContours(ai2, eng, SP)), 'edited nodule: every slice keeps its outline');
// round trip back to the AI's slice leaves no stray edits
const back = keySlicePatch({ ...ai, ...p }, 175, opts);
ok(back.slice_number === 176 && Object.keys(back.contour_edits).length === 0 && back.long_axis_mm === ax175.long_axis_mm, 'moving back to the AI slice restores the AI axes, no slice edits left');

// 4. Hand-drawn nodule: only slices Daniel outlined are options; a later edit doesn't move the key slice back.
const hand = { source: 'Added by reviewer', kind: 'nodule', key_slice_z: 50, slice_number: 51, key_contour_px: ellipse(100, 100, 10, 8), contour_edits: { 48: ellipse(100, 100, 6, 5), 52: ellipse(100, 100, 7, 6) } };
ok(same(keySliceOptions(hand, null, SP), [48, 50, 52]), `hand-drawn: options = outlined slices only, not the filled-in ones (got ${keySliceOptions(hand, null, SP)})`);
ok(keySlicePatch(hand, 51, { ...opts, engineContours: null }) === null, 'hand-drawn: a filled-in slice cannot be the key slice');
const ph = keySlicePatch(hand, 52, { ...opts, engineContours: null });
const hand2 = { ...hand, ...ph };
ok(hand2.key_slice_z === 52 && same(hand2.contour_edits['50'], hand.key_contour_px) && !('52' in hand2.contour_edits), 'hand-drawn: moved to 52, old key outline kept');
const after = slicePatch(hand2, 48, ellipse(100, 100, 5, 5), { sp: SP, dz: DZ, engineContours: null, slices });
ok(!('key_slice_z' in after), 'a later edit does not move a chosen key slice back to the largest slice');
const auto = slicePatch(hand, 52, ellipse(100, 100, 14, 12), { sp: SP, dz: DZ, engineContours: null, slices });
ok(auto.key_slice_z === 52, 'without a choice, hand-drawn nodules still follow their largest slice (unchanged)');

// 5. Saved through the app's own save: trail, volume, confirmation, then Undo.
const scan = await Scan.create({ engine_scan_id: 'K_test', patient_id: 'K', timepoint: 'Baseline', scan_date: '2006-01-10', review_status: 'In review', approved_by_initials: 'DR', minutes_on_scan: 20 });
const n = await Nodule.create({ scan: scan.id, nodule_label: 'N1', status: 'Accepted', lobe: 'RUL', type: 'Solid', mean_diameter_mm: meanOf(ax175.long_axis_mm, ax175.short_axis_mm), ...ai });
const QUIET = ['key_contour_px', 'contour_edits'];
const FIELDS = ['key_contour_px', 'contour_edits', 'key_slice_z', 'key_slice_manual', 'slice_number', 'long_axis_px', 'short_axis_px', 'long_axis_mm', 'short_axis_mm', 'volume_mm3', 'volume_stale'];
const prev = { ...Object.fromEntries(FIELDS.map((f) => [f, n[f] ?? null])), outline_confirmed: true };
await saveNodule(scan, n, { ...keySlicePatch(n, 177, opts), outline_confirmed: true }, me, { source: 'key slice set by hand', quiet: QUIET });
const s1 = await Nodule.get(n.id);
ok(s1.slice_number === 178 && s1.volume_mm3 === 1234 && s1.outline_confirmed === true, `saved: Slice # 178, volume 1234 unchanged, outline still confirmed (got ${s1.slice_number}, ${s1.volume_mm3}, ${s1.outline_confirmed})`);
const ev = (await EditEvent.filter({ scan: scan.id })).items;
const row = (f) => ev.find((e) => e.field === f);
ok(row('slice_number')?.ai_value === '176' && row('slice_number')?.old_value === '176' && row('slice_number')?.new_value === '178' && row('slice_number')?.source === 'key slice set by hand',
  `trail: Slice # AI 176 → 178, how (got ${row('slice_number')?.ai_value} / ${row('slice_number')?.old_value} → ${row('slice_number')?.new_value}, ${row('slice_number')?.source})`);
ok(row('long_axis_mm')?.new_value === String(ax177.long_axis_mm) && row('short_axis_mm'), 'trail: long and short axis rows');
ok(!row('outline') && !row('volume_mm3') && !row('outline_confirmed'), `no outline / volume / confirmation rows (the outline didn't change): ${ev.map((e) => e.field).join(', ')}`);
ok(s1.was_edited === true, 'counts as edited (export: "AI-assisted; edited: slice, …")');
// export: Measurements Slice # and the trail row name
const sc = await Scan.get(scan.id);
const meas = measurementRows([sc], [s1]);
ok(meas[0][7] === 178 && meas[0][9] === ax177.long_axis_mm, `export: Slice # 178, long axis ${ax177.long_axis_mm} (got ${meas[0][7]}, ${meas[0][9]})`);
const tr = trailRows([sc], ev, [s1]);
ok(tr.some((r) => r[4] === 'slice_number (key slice set by hand)' && r[5] === '176' && r[7] === '178'), 'export trail: "slice_number (key slice set by hand)", AI 176 → 178');
ok(tr.some((r) => r[4] === 'Review result' && /edited: .*slice/.test(r[7])), 'export review result mentions the slice');
// Undo (what Review's undo sends for a key-slice step)
await saveNodule(scan, s1, prev, me, { source: 'undo', quiet: QUIET });
const s2 = await Nodule.get(n.id);
ok(s2.key_slice_z === 175 && s2.slice_number === 176 && s2.long_axis_mm === ax175.long_axis_mm && same(s2.key_contour_px, eng[175][0]) && s2.outline_confirmed === true && s2.volume_mm3 === 1234,
  'undo: back to key slice 176 with the AI axes, outline still confirmed, volume unchanged');
ok(!s2.key_slice_manual, 'undo: no longer marked as chosen');
console.log(fail ? `${fail} failed` : 'all pass');
