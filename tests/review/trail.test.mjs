// Edit trail: "Previous value" = the value just before that edit, and no rows for non-changes.
// Runs the app's own saveNodule against the in-memory Base44 stand-in.
import { base44 } from '@/api/base44Client';
import { saveNodule, logEvent } from '@/lib/edits';
const { Scan, Nodule, EditEvent } = base44.entities;
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };
const me = { user: { email: 'stav@x' }, initials: 'SD' };
const scan = await Scan.create({ engine_scan_id: 'S1', patient_id: 'P1', timepoint: 'Baseline' });
const n0 = await Nodule.create({ scan: scan.id, nodule_label: 'N2', source: 'AI', status: 'Pending', short_axis_mm: 8.5, long_axis_mm: 10, ai_draft: { short: 8.5 } });
const trail = async (field) => (await EditEvent.filter({ nodule: n0.id }, { sort: 'edited_at' })).items.filter((e) => !field || e.field === field);

// 11. The page holds the nodule as it was when selected; two edits in a row pass that same (stale) object.
await saveNodule(scan, n0, { short_axis_mm: 39.2 }, me);
await saveNodule(scan, n0, { short_axis_mm: 8.3 }, me);
const sa = await trail('short_axis_mm');
ok(sa.length === 2, `two short-axis rows (got ${sa.length})`);
ok(sa[0]?.old_value === '8.5' && sa[0]?.new_value === '39.2', `1st: 8.5 → 39.2 (got ${sa[0]?.old_value} → ${sa[0]?.new_value})`);
ok(sa[1]?.old_value === '39.2' && sa[1]?.new_value === '8.3', `2nd: 39.2 → 8.3 (got ${sa[1]?.old_value} → ${sa[1]?.new_value})`);
ok(sa.every((e) => e.ai_value === '8.5'), 'AI value stays the AI draft');
ok((await Nodule.get(n0.id)).short_axis_mm === 8.3, 'saved value 8.3');
// Setting the value it already has (stale object says 39.2 → 8.3 again) logs nothing.
await saveNodule(scan, n0, { short_axis_mm: 8.3 }, me);
ok((await trail('short_axis_mm')).length === 2, 'same value again → no new row');

// 13. Accept sends reject_reason: '' while the record has none → no "reject_reason: ∅ → ∅" row.
const before = (await trail()).length;
await saveNodule(scan, n0, { status: 'Accepted', reject_reason: '' }, me);
const added = (await trail()).slice(before);
ok(added.length === 1 && added[0].field === 'status', `Accept logs only status (got ${added.map((e) => `${e.field}: ${e.old_value || '∅'} → ${e.new_value || '∅'}`).join(', ')})`);
// Empty forms are all "nothing": null, '', [], {} → no rows.
const n1 = await Nodule.create({ scan: scan.id, nodule_label: 'N3', source: 'Added by reviewer', status: 'Pending', notes: '' });
await saveNodule(scan, n1, { notes: null, match_to_prior: '', contour_edits: {}, key_contour_px: [] }, me);
ok((await EditEvent.filter({ nodule: n1.id })).items.length === 0, 'empty → empty logs nothing');
// A real change from empty is still logged.
await saveNodule(scan, n1, { notes: 'faint' }, me);
const nt = (await EditEvent.filter({ nodule: n1.id })).items;
ok(nt.length === 1 && nt[0].old_value === '' && nt[0].new_value === 'faint', 'notes ∅ → faint logged');
// Scan-level events with no change are skipped too.
const cnt = (await EditEvent.filter({ scan: scan.id })).items.length;
await logEvent(scan, null, 'central_areas_checked', '', '', me);
ok((await EditEvent.filter({ scan: scan.id })).items.length === cnt, 'logEvent ∅ → ∅ skipped');
console.log(fail ? `${fail} failed` : 'all pass');
