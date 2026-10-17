// Bug 2 (Stav, 17 Oct): rejected AI findings left no trace in the export. They stay out of Measurements but must be in
// the Edit trail (AI draft + "Rejected: reason" + their changes), once (not repeated in every daily export).
import * as XLSX from 'xlsx';
import { base44 } from '@/api/base44Client';
import { initNodules } from '@/lib/initNodules';
import { saveNodule, approveScan, markCentralChecked } from '@/lib/edits';
import { buildWorkbook } from '@/lib/exportWorkbook';
import { selectForExport, markExported } from '@/lib/exportSelect';
const { Scan, Nodule, EditEvent } = base44.entities;
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };
const me = { user: { email: 'stav@x' }, initials: 'SD' };
const F = (id, z, long, extra = {}) => ({ finding_id: id, lobe: 'RUL', type_guess: 'Solid', key_slice_z: z, key_slice_number: z + 1, long_axis_mm: long, short_axis_mm: long * 0.8, volume_mm3: 100, confidence: 0.9, flags: [],
  contours: { [z]: [[[0, 0], [10, 0], [10, 10], [0, 10]]] }, long_axis_px: [[0, 5], [10, 5]], short_axis_px: [[5, 0], [5, 10]], match: null, ...extra });
const fu = await Scan.create({ engine_scan_id: 'R_retest', patient_id: 'R', timepoint: 'Follow-up 1', scan_date: '2006-01-10', review_status: 'In review', engine_version: '0.4.0' });
await initNodules(fu, [F('F1', 10, 14.6), F('F2', 20, 6.1), F('F3', 30, 4.4)], []);
const by = async (l) => (await Nodule.filter({ scan: fu.id })).items.find((n) => n.nodule_label === l);
await saveNodule(fu, await by('N1'), { match_to_prior: 'N/A' }, me);
await saveNodule(fu, await by('N1'), { status: 'Accepted' }, me);
await saveNodule(fu, await by('N2'), { status: 'Rejected', reject_reason: 'Vessel' }, me);
await saveNodule(fu, await by('N3'), { long_axis_mm: 3.9 }, me);
await saveNodule(fu, await by('N3'), { status: 'Rejected', reject_reason: 'Under 4 mm' }, me);
await markCentralChecked(fu, me);
await approveScan(fu, 300, me, 400);

// what Results does on "Export selected": accepted rows + this scan's rejected findings + events
const exportNow = async () => {
  const scans = (await Scan.filter({ review_status: 'Approved' })).items;
  const all = (await Nodule.filter({ scan: { $in: scans.map((s) => s.id) } })).items;
  const events = (await EditEvent.filter({ scan: { $in: scans.map((s) => s.id) } }, { sort: 'edited_at' })).items;
  const sel = selectForExport({ scans, nodules: all.filter((n) => n.status === 'Accepted'), rejected: all.filter((n) => n.status === 'Rejected'), events, onlyPending: true });
  const wb = buildWorkbook(XLSX, { ...sel, initials: 'SD', date: '2026-10-17' });
  await markExported([...sel.nodules, ...(sel.rejected || [])]);
  return { meas: XLSX.utils.sheet_to_json(wb.Sheets.Measurements, { header: 1 }).slice(1), trail: XLSX.utils.sheet_to_json(wb.Sheets['Edit trail'], { header: 1 }).slice(1) };
};
const d1 = await exportNow();
ok(d1.meas.length === 1 && d1.meas[0][5] === 'N1', `Measurements = N1 only (got ${d1.meas.map((r) => r[5]).join(',')})`);
const rowsOf = (t, l) => t.filter((r) => r[3] === l);
for (const [l, reason] of [['N2', 'Vessel'], ['N3', 'Under 4 mm']]) {
  const r = rowsOf(d1.trail, l);
  ok(r.some((x) => x[4] === 'AI draft' && /long 6\.1|long 4\.4/.test(String(x[5]))), `${l}: AI draft row with what the AI proposed`);
  ok(r.some((x) => x[4] === 'Review result' && String(x[7]) === `Rejected: ${reason}`), `${l}: Review result "Rejected: ${reason}" (got ${r.filter((x) => x[4] === 'Review result').map((x) => x[7])})`);
  ok(r.some((x) => x[4] === 'status' && x[6] === 'Pending' && x[7] === 'Rejected'), `${l}: status change row Pending → Rejected`);
}
ok(rowsOf(d1.trail, 'N3').some((x) => x[4] === 'long_axis_mm' && x[6] === '4.4' && x[7] === '3.9'), 'N3: the edit before rejecting is kept');
// next day, nothing changed → nothing again (rejected findings are tracked like rows, not repeated)
const d2 = await exportNow();
ok(d2.meas.length === 0 && !d2.trail.some((r) => r[3] === 'N2' || r[3] === 'N3'), `day 2: no repeat (got ${d2.trail.length} trail rows)`);
console.log(fail ? `${fail} failed` : 'all pass');
