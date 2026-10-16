// Export test: runs the app's own code (src/lib) on one patient, Baseline + Follow-up 1,
// doing what Daniel does in the Review screen, then writes the Excel exactly as the Export page does.
// The AI findings are synthetic but in the engine API contract v1 shape. Run: node tests/export/run.mjs
import * as XLSX from 'xlsx';
import { base44 } from '@/api/base44Client';
import { initNodules } from '@/lib/initNodules';
import { saveNodule, approveScan, markCentralChecked } from '@/lib/edits';
import { buildWorkbook } from '@/lib/exportWorkbook';
import { selectForExport, markExported } from '@/lib/exportSelect';
import { measurementRows } from '@/lib/exportRows';
import { lenMm, meanOf, volumeAfterKeyEdit } from '@/lib/geometry';

const { Scan, Nodule, EditEvent } = base44.entities;
const me = { user: { email: 'daniel.reyes@harbor.example' }, initials: 'DR' };
const SP = [0.7, 0.7]; // pixel spacing mm
const ring = (cx, cy, r, n = 16) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)].map((v) => Math.round(v * 10) / 10));
const finding = (o) => ({
  confidence: 0.9, flags: [], source: 'ai', contours: { [o.key_slice_z]: [ring(o.cx, o.cy, 10)] },
  long_axis_px: [[o.cx - 10, o.cy], [o.cx + 10, o.cy]], short_axis_px: [[o.cx, o.cy - 8], [o.cx, o.cy + 8]], match: null, ...o,
});
const nod = async (scanId, label) => (await Nodule.filter({ scan: scanId })).items.find((n) => n.nodule_label === label);
const save = async (scan, label, patch, opts) => saveNodule(scan, await nod(scan.id, label), patch, me, opts);

// Same record the Review page creates when Daniel adds a nodule by hand (4 clicks, no live engine).
async function addByHand(scan, z, sliceNumber, L, S) {
  const geom = { long_axis_px: L, short_axis_px: S, long_axis_mm: lenMm(L, SP), short_axis_mm: lenMm(S, SP) };
  const n = (await Nodule.filter({ scan: scan.id })).items.length;
  return Nodule.create({
    scan: scan.id, engine_scan_id: scan.engine_scan_id, nodule_label: `N${n + 1}`, source: 'Added by reviewer', engine_finding_id: '', status: 'Pending',
    was_edited: false, lobe: '', type: 'Solid', slice_number: sliceNumber, key_slice_z: z, outline_confirmed: false, match_to_prior: '', flags: [], ai_draft: {},
    key_contour_px: [], volume_stale: !geom.volume_mm3, ...geom, mean_diameter_mm: meanOf(geom.long_axis_mm, geom.short_axis_mm),
  });
}

export async function runScenario() {
  // ---------- Baseline ----------
  const base = await Scan.create({ engine_scan_id: 'RIDER-TEST_test', patient_id: 'RIDER-TEST', scan_date: '2006-01-10', timepoint: 'Baseline', series_number: 3, slice_thickness_mm: 1.25, n_slices: 280, prior_engine_scan_id: '', review_status: 'Not started', active_seconds: 0, engine_version: '0.3.0' });
  await initNodules(base, [
    finding({ finding_id: 'F1', lobe: 'RUL', type_guess: 'Solid', key_slice_z: 141, key_slice_number: 142, long_axis_mm: 14.2, short_axis_mm: 11.04, volume_mm3: 1180.4, solid_component_mm: null, cx: 300, cy: 200 }),
    finding({ finding_id: 'F2', lobe: 'LLL', type_guess: 'Ground-glass', key_slice_z: 220, key_slice_number: 221, long_axis_mm: 6.3, short_axis_mm: 5.15, volume_mm3: 96.2, solid_component_mm: null, cx: 150, cy: 330 }),
  ], []);
  // N1: Daniel checks the edges, confirms the outline, accepts.
  await save(base, 'N1', { outline_confirmed: true, outline_confirmed_by_initials: 'DR', outline_confirmed_at: new Date().toISOString() });
  await save(base, 'N1', { status: 'Accepted' });
  // N2: Daniel types a longer long axis, drags one outline point outwards (no live engine), confirms, accepts.
  // Same steps as the Review page's onDragEnd: volume recomputed in the browser from the edited outline.
  await save(base, 'N2', { long_axis_mm: 6.8 });
  const n2 = await nod(base.id, 'N2');
  const edited = n2.key_contour_px.map((p, i) => (i === 0 ? [p[0] + 3, p[1]] : p));
  const vol = volumeAfterKeyEdit({ oldVolume: n2.volume_mm3, oldPoly: n2.key_contour_px, newPoly: edited, sp: SP, dz: 1.25, contoursByZ: {}, keyZ: n2.key_slice_z });
  await save(base, 'N2', { key_contour_px: edited, volume_mm3: vol, volume_stale: false }, { source: 'points moved by hand; volume recomputed' });
  await save(base, 'N2', { outline_confirmed: true, outline_confirmed_by_initials: 'DR', outline_confirmed_at: new Date().toISOString() });
  await save(base, 'N2', { status: 'Accepted' });
  // N3: Daniel adds a small spot the AI did not mark (3.5 x 2.8 mm). Accept is disabled under 4 mm,
  // so he rejects it ("Under 4 mm"). N4: same size, but we force status Accepted to test the export's own 4 mm guard.
  await addByHand(base, 90, 91, [[400, 120], [405, 120]], [[402.5, 118], [402.5, 122]]);
  await save(base, 'N3', { status: 'Rejected', reject_reason: 'Under 4 mm' });
  await addByHand(base, 60, 61, [[380, 100], [385, 100]], [[382.5, 98], [382.5, 102]]);
  await save(base, 'N4', { status: 'Accepted' });
  await markCentralChecked(base, me); // required step: hilum / mediastinum checked
  await approveScan(base, 1980, me); // timer: 33:00 of active time

  // Day 1: Daniel presses "Export to Excel" in Results with "Only rows not exported yet" (the default).
  const daily = [];
  const exportPending = async (day) => {
    const scans = (await Scan.filter({ review_status: 'Approved' })).items;
    const nodules = (await Nodule.filter({ scan: { $in: scans.map((x) => x.id) }, status: 'Accepted' })).items;
    const events = (await EditEvent.filter({ scan: { $in: scans.map((x) => x.id) } }, { sort: 'edited_at' })).items;
    const sel = selectForExport({ scans, nodules, events, onlyPending: true });
    const rows = measurementRows(sel.scans, sel.nodules, sel.events);
    const wbDay = buildWorkbook(XLSX, { ...sel, initials: 'DR', date: `2026-10-${day}` });
    const readme = XLSX.utils.sheet_to_json(wbDay.Sheets['Read me'], { header: 1 }).map((r) => r[0]).filter(Boolean).slice(1);
    await markExported(sel.nodules, `2026-10-${day}T18:00:00.000Z`);
    daily.push({ day: `Oct ${day}`, rows: rows.map((r) => `${r[2]} ${r[5]}`), readme });
  };
  await exportPending(15);

  // ---------- Follow-up 1 (same patient) ----------
  const fu = await Scan.create({ engine_scan_id: 'RIDER-TEST_retest', patient_id: 'RIDER-TEST', scan_date: '2006-01-10', timepoint: 'Follow-up 1', series_number: 4, slice_thickness_mm: 1.25, n_slices: 282, prior_engine_scan_id: 'RIDER-TEST_test', review_status: 'Not started', active_seconds: 0, engine_version: '0.3.0' });
  const prior = (await Nodule.filter({ scan: base.id })).items;
  await initNodules(fu, [
    finding({ finding_id: 'F1', lobe: 'RUL', type_guess: 'Part-solid', key_slice_z: 150, key_slice_number: 151, long_axis_mm: 14.6, short_axis_mm: 10.8, volume_mm3: 1214, solid_component_mm: 8.2, cx: 305, cy: 210,
      match: { prior_scan_id: 'RIDER-TEST_test', prior_finding_id: 'F1', distance_mm: 3.1, confidence: 0.91, set_by: 'ai' } }),
    finding({ finding_id: 'F2', lobe: 'RML', type_guess: 'Solid', key_slice_z: 175, key_slice_number: 176, long_axis_mm: 4.4, short_axis_mm: 4.0, volume_mm3: 38, solid_component_mm: null, cx: 260, cy: 300 }),
  ], prior);
  // State right after the AI draft, before Daniel touches anything (to prove the AI does not fill Match to prior).
  const afterInit = (await Nodule.filter({ scan: fu.id })).items.map((n) => ({ label: n.nodule_label, match_to_prior: n.match_to_prior, ai_suggests: n.ai_draft?.match_label }));
  // N1: Daniel clicks "Use suggestion" (N1), confirms the outline, accepts.
  await save(fu, 'N1', { match_to_prior: 'N1' });
  await save(fu, 'N1', { outline_confirmed: true, outline_confirmed_by_initials: 'DR', outline_confirmed_at: new Date().toISOString() });
  await save(fu, 'N1', { status: 'Accepted' });
  // N2: new nodule. Daniel picks "N/A", adds a note, does NOT confirm the outline, accepts.
  await save(fu, 'N2', { match_to_prior: 'N/A' });
  await save(fu, 'N2', { notes: 'New since prior, faint' });
  await save(fu, 'N2', { status: 'Accepted' });
  await markCentralChecked(fu, me);
  await approveScan(fu, 1500, me); // 25:00
  // Day 2: export again (default "only new"): should hold only the follow-up rows.
  await exportPending(16);
  // Day 3: Daniel adds a note to an already-exported Baseline row → it changed, so it goes out again; nothing else does.
  await save(base, 'N1', { notes: 'Clear edges' });
  await exportPending(17);
  // Day 4: nothing changed → nothing to export.
  await exportPending(18);

  // ---------- Export, exactly like the Export page ----------
  const scans = (await Scan.filter({ review_status: 'Approved' }, { sort: 'patient_id' })).items;
  const ids = scans.map((s) => s.id);
  const nodules = (await Nodule.filter({ scan: { $in: ids }, status: 'Accepted' }, { sort: 'nodule_label' })).items;
  const events = (await EditEvent.filter({ scan: { $in: ids } }, { sort: 'edited_at' })).items;
  const wb = buildWorkbook(XLSX, { scans, nodules, events, initials: 'DR', date: '2026-10-15' });
  return { wb, afterInit, daily, all: { scans, nodules: (await Nodule.filter({})).items } };
}
