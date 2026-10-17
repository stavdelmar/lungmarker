// Two edit-trail tidy-ups from Stav's follow-up export (17 Oct):
// (1) Approve is idempotent: a double click logs "scan_approved" once.
// (2) Consecutive outline edits on one nodule (dragging points) → one row per field in the export,
//     first previous value → last new value; the raw trail in Base44 keeps every row.
import { base44 } from '@/api/base44Client';
import { saveNodule, approveScan, markCentralChecked } from '@/lib/edits';
import { trailRows } from '@/lib/exportRows';
import { groupOutlineEdits } from '@/lib/trailGroup';
const { Scan, Nodule, EditEvent } = base44.entities;
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };
const me = { user: { email: 'stav@x' }, initials: 'SD' };
const tick = () => new Promise((r) => setTimeout(r, 3)); // distinct edited_at per save, like real drags
const approvals = async (s) => (await EditEvent.filter({ scan: s.id })).items.filter((e) => e.field === 'scan_approved');

// (1) Double click: two calls at once, then a third after it finished (page still holds the old copy).
const s1 = await Scan.create({ engine_scan_id: 'S1', patient_id: 'P1', timepoint: 'Follow-up 1', scan_date: '2025-01-14', review_status: 'In review' });
const [a, b] = await Promise.all([approveScan(s1, 300, me, 400), approveScan(s1, 300, me, 400)]);
ok(a === b, 'simultaneous calls share one approval');
await approveScan(s1, 320, me, 420);
ok((await approvals(s1)).length === 1, `scan_approved logged once (got ${(await approvals(s1)).length})`);
ok((await Scan.get(s1.id)).minutes_on_scan === 5, 'minutes from the first approval kept (active 300 s → 5)');
// A reopened scan (back in review) can be approved again — that is a real second approval.
await Scan.update(s1.id, { review_status: 'In review' });
await approveScan(s1, 600, me, 700);
ok((await approvals(s1)).length === 2, 're-approval after reopen is logged');

// (2) Outline drags on N1: 12 drags, each saving outline + long + short + volume.
const s2 = await Scan.create({ engine_scan_id: 'S2', patient_id: 'P2', timepoint: 'Baseline', scan_date: '2025-02-01' });
const pts = (k) => Array.from({ length: 16 }, (_, i) => [i, i + k]);
const n1 = await Nodule.create({ scan: s2.id, nodule_label: 'N1', source: 'AI', status: 'Accepted', long_axis_mm: 10, short_axis_mm: 8, volume_mm3: 400, key_contour_px: pts(0), outline_confirmed: true,
  ai_draft: { long: 10, short: 8, volume: 400, contour: pts(0) } });
const n2 = await Nodule.create({ scan: s2.id, nodule_label: 'N2', source: 'AI', status: 'Accepted', long_axis_mm: 6, short_axis_mm: 5, key_contour_px: pts(0), ai_draft: { long: 6, short: 5, contour: pts(0) } });
for (let k = 1; k <= 12; k++) { await tick(); await saveNodule(s2, n1, { key_contour_px: pts(k), long_axis_mm: 10 + k / 10, short_axis_mm: 8 + (k % 2) / 10, volume_mm3: 400 + k }, me); }
// short axis ends where it started (8.0 after an even number of drags) → no short-axis row
await tick(); await saveNodule(s2, n1, { key_contour_px: pts(13), long_axis_mm: 11.3, short_axis_mm: 8, volume_mm3: 413 }, me, { source: 'Erase' });
// another field on the same nodule ends the run …
await tick(); await saveNodule(s2, n1, { lobe: 'RUL' }, me);
// … so this drag is a new run
await tick(); await saveNodule(s2, n1, { key_contour_px: pts(20), long_axis_mm: 12, volume_mm3: 420 }, me);
// a drag on another nodule in between also ends a run
await tick(); await saveNodule(s2, n2, { key_contour_px: pts(1), long_axis_mm: 6.5 }, me);
await tick(); await saveNodule(s2, n1, { key_contour_px: pts(21), long_axis_mm: 12.2 }, me);
await tick(); await markCentralChecked(s2, me);

const raw = (await EditEvent.filter({ scan: s2.id })).items;
ok(raw.length > 50, `raw trail keeps every row (${raw.length})`);
const g = groupOutlineEdits(raw).filter((e) => e.nodule === n1.id);
const first = g.filter((e) => e.edited_at <= raw.find((x) => x.field === 'lobe').edited_at);
const f = (field) => first.filter((e) => e.field === field);
ok(f('outline').length === 1 && f('long_axis_mm').length === 1 && f('volume_mm3').length === 1, `first run: one row per field (got ${first.map((e) => e.field).join(', ')})`);
ok(f('long_axis_mm')[0]?.old_value === '10' && f('long_axis_mm')[0]?.new_value === '11.3', `long axis 10 → 11.3 (got ${f('long_axis_mm')[0]?.old_value} → ${f('long_axis_mm')[0]?.new_value})`);
ok(f('volume_mm3')[0]?.old_value === '400' && f('volume_mm3')[0]?.new_value === '413', 'volume 400 → 413');
ok(f('long_axis_mm')[0]?.ai_value === '10', 'AI value kept');
ok(f('short_axis_mm').length === 0, 'short axis back where it started → no row');
ok(f('outline_confirmed').length === 1 && f('outline_confirmed')[0].old_value === 'true', 'outline un-confirmed once (true → false)');
ok(/13 edits grouped/.test(f('outline')[0]?.new_value) && f('outline')[0]?.source === 'points moved by hand, Erase', `outline row says 13 edits, both ways (got "${f('outline')[0]?.new_value}", ${f('outline')[0]?.source})`);
ok(f('outline')[0]?.edited_at === raw.filter((x) => x.field === 'outline' && x.nodule === n1.id)[12].edited_at, 'time = last edit of the run');
ok(g.filter((e) => e.field === 'lobe').length === 1, 'lobe row unchanged');
ok(g.filter((e) => e.field === 'outline').length === 3, `N1: 3 outline rows (run, run, run after N2) — got ${g.filter((e) => e.field === 'outline').length}`);
ok(groupOutlineEdits(raw).filter((e) => e.nodule === n2.id && e.field === 'outline').length === 1, 'N2 drag stays its own row');
ok(groupOutlineEdits(raw).some((e) => e.field === 'central_areas_checked'), 'scan-level rows kept');
// Through the export's trail builder.
const rows = trailRows([await Scan.get(s2.id)], raw, [await Nodule.get(n1.id), await Nodule.get(n2.id)]);
const changeRows = rows.filter((r) => !['AI draft', 'Review result'].includes(r[4]));
ok(changeRows.length < 15, `export trail rows for this scan: ${changeRows.length} (raw ${raw.length})`);
ok(changeRows.some((r) => r[4] === 'outline (points moved by hand, Erase)'), 'export names how the outline was edited');
console.log(fail ? `${fail} failed` : 'all pass');
