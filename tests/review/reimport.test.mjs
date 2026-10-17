// Engine output changed after import → detect it, and reset scans safely (trail kept, export starts at the reset).
import * as XLSX from 'xlsx';
import { base44 } from '@/api/base44Client';
import { fingerprint, engineState, withLaterScans, resetScans, liveEvents } from '@/lib/reimport';
import { initNodules } from '@/lib/initNodules';
import { saveNodule, approveScan, markCentralChecked } from '@/lib/edits';
import { buildWorkbook } from '@/lib/exportWorkbook';
const { Scan, Nodule, EditEvent } = base44.entities;
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };
const me = { user: { email: 'stav@x' }, initials: 'SD' };
const F = (id, vol, extra = {}) => ({ finding_id: id, lobe: 'RUL', type_guess: 'Solid', key_slice_z: 10, key_slice_number: 11, long_axis_mm: 12, short_axis_mm: 10, volume_mm3: vol, confidence: 0.9, flags: [],
  contours: { 10: [[[0, 0], [10, 0], [10, 10], [0, 10]]] }, long_axis_px: [[0, 5], [10, 5]], short_axis_px: [[5, 0], [5, 10]], match: null, ...extra });
const oldOut = { findings: [F('F1', 900)], match_summary: { new_in_current: [], not_found_in_current: [] } };
const newOut = { findings: [F('F1', 760)], match_summary: { new_in_current: [], not_found_in_current: [] } }; // new outline rule → new volume

// fingerprint / state
ok(fingerprint(oldOut) === fingerprint(JSON.parse(JSON.stringify(oldOut))), 'fingerprint stable');
ok(fingerprint(oldOut) !== fingerprint(newOut), 'fingerprint changes with the outline');
const B = await Scan.create({ engine_scan_id: 'P_test', patient_id: 'P', timepoint: 'Baseline', scan_date: '2006-01-10', review_status: 'Not started', series_number: 3 });
const U = await Scan.create({ engine_scan_id: 'P_retest', patient_id: 'P', timepoint: 'Follow-up 1', scan_date: '2006-01-10', review_status: 'Not started', prior_engine_scan_id: 'P_test' });
const Q = await Scan.create({ engine_scan_id: 'Q_test', patient_id: 'Q', timepoint: 'Baseline', review_status: 'Not started' });
ok(engineState(B, newOut) === 'not imported', 'never opened → will use the current output');
// first opening (what Review does): copy the AI draft + fingerprint
await initNodules(B, oldOut.findings, []);
await Scan.update(B.id, { review_status: 'In review', ai_fingerprint: fingerprint(oldOut), ai_imported_at: new Date().toISOString() });
let b = await Scan.get(B.id);
ok(engineState(b, oldOut) === 'same', 'same output → same');
ok(engineState(b, newOut) === 'changed', 'S3 updated → changed');
ok(engineState({ ...b, ai_fingerprint: '' }, newOut) === 'unknown', 'imported before tracking → unknown');
// Stav's test review: edit, central check, approve
const n1 = (await Nodule.filter({ scan: B.id })).items[0];
await saveNodule(b, n1, { long_axis_mm: 13.1 }, me);
await saveNodule(b, n1, { status: 'Accepted' }, me);
await markCentralChecked(b, me);
await approveScan(b, 600, me, 900);
await Scan.update(U.id, { review_status: 'In review' });
await Nodule.create({ scan: U.id, nodule_label: 'N1', status: 'Pending', source: 'AI' });
const before = (await EditEvent.filter({})).items.length;

// reset the Baseline → the follow-up comes with it; patient Q untouched
const all = (await Scan.filter({})).items;
const aff = withLaterScans([await Scan.get(B.id)], all);
ok(aff.map((s) => s.timepoint).sort().join() === 'Baseline,Follow-up 1', 'baseline reset includes its follow-up');
ok(withLaterScans([await Scan.get(U.id)], all).length === 1, 'follow-up alone does not drag the baseline');
const r = await resetScans(aff, me, { engineScans: [{ scan_id: 'P_test', series_number: 5, n_findings: 1 }] });
ok(r.scans === 2 && r.nodules === 2, `reset 2 scans, 2 nodules (got ${JSON.stringify(r)})`);
b = await Scan.get(B.id);
ok(b.review_status === 'Not started' && !b.approved_at && !b.central_checked_at && b.total_seconds === 0 && !b.ai_fingerprint && !!b.reset_at, 'baseline back to never reviewed');
ok(b.series_number === 5, 'metadata refreshed from scans.json');
ok((await Nodule.filter({ scan: B.id })).items.length === 0 && (await Nodule.filter({ scan: U.id })).items.length === 0, 'nodules removed');
ok((await Scan.get(Q.id)).review_status === 'Not started' && !(await Scan.get(Q.id)).reset_at, 'other patient untouched');
const evs = (await EditEvent.filter({})).items;
ok(evs.length === before + 2, `trail kept + 2 reset rows (before ${before}, after ${evs.length})`);
ok(liveEvents([b], evs.filter((e) => e.scan === B.id)).every((e) => e.field === 'scan_reset'), 'only the reset row is live before re-review');

// re-review on the new output, approve, export: the trail starts at the reset
await initNodules(b, newOut.findings, []);
await Scan.update(B.id, { review_status: 'In review', ai_fingerprint: fingerprint(newOut) });
b = await Scan.get(B.id);
const m1 = (await Nodule.filter({ scan: B.id })).items[0];
ok(m1.volume_mm3 === 760 && m1.ai_draft.volume === 760, 'new AI draft = new engine output');
await saveNodule(b, m1, { status: 'Accepted' }, me);
await markCentralChecked(b, me);
await approveScan(b, 300, me, 420);
b = await Scan.get(B.id);
const wb = buildWorkbook(XLSX, { scans: [b], nodules: (await Nodule.filter({ scan: B.id })).items, events: (await EditEvent.filter({ scan: B.id })).items, initials: 'SD', date: '2026-10-17' });
const trail = XLSX.utils.sheet_to_json(wb.Sheets['Edit trail'], { header: 1 }).slice(1);
const fields = trail.map((t) => t[4]);
ok(!trail.some((t) => String(t[7]).includes('13.1')), 'old test edit (13.1) not in the export');
ok(fields.filter((f) => f === 'scan_approved').length === 1 && fields.filter((f) => f === 'central_areas_checked').length === 1, `one approval + one central check (got ${fields.join(', ')})`);
ok(fields.includes('scan_reset'), 'the reset itself is in the trail (honest)');
ok(XLSX.utils.sheet_to_json(wb.Sheets.Measurements, { header: 1 })[1][15] === 7, 'Minutes on scan = the re-review only (7)');
console.log(fail ? `${fail} failed` : 'all pass');
