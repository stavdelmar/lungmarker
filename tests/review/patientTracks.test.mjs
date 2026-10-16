// Per-patient change view + review breakdown (Results, for Naomi) and the soft "no volume" reminder.
import { patientTracks, reviewBreakdown } from '@/lib/patientTracks';
import { unconfirmedOutlines } from '@/lib/reviewChecks';
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };
const B = { id: 'b', patient_id: 'P1', timepoint: 'Baseline', scan_date: '2006-01-10' };
const F = { id: 'f', patient_id: 'P1', timepoint: 'Follow-up 1', scan_date: '2006-01-10' };
const N = (id, scan, label, o = {}) => ({ id, scan, nodule_label: label, status: 'Accepted', source: 'AI', lobe: 'RUL', outline_confirmed: true, ...o });
const nods = [
  N('b1', 'b', 'N1', { long_axis_mm: 14.2, volume_mm3: 1180 }),
  N('b2', 'b', 'N2', { long_axis_mm: 6.0, volume_mm3: 100, lobe: 'LLL' }),
  N('b3', 'b', 'N3', { long_axis_mm: 5.0, volume_mm3: 50 }),
  N('b4', 'b', 'N4', { status: 'Rejected' }),
  N('f1', 'f', 'N1', { long_axis_mm: 14.6, volume_mm3: 1214, match_to_prior: 'N1', was_edited: true }),
  N('f2', 'f', 'N2', { long_axis_mm: 5.7, volume_mm3: 90, match_to_prior: 'N2', outline_confirmed: false, lobe: 'LLL' }),
  N('f3', 'f', 'N3', { long_axis_mm: 4.4, match_to_prior: 'N/A', source: 'Added by reviewer', outline_confirmed: false }),
  { id: 'fx', scan: 'f', kind: 'prior_not_found', prior_label: 'N3', status: 'Accepted', match_to_prior: 'Not found' },
];
const [p] = patientTracks([F, B], nods);
ok(p.timepoints.map((s) => s.timepoint).join() === 'Baseline,Follow-up 1', 'timepoints in order');
ok(p.sameDay, 'same-day repeat detected (RIDER)');
const t1 = p.tracks.find((t) => t.labels.join() === 'N1,N1');
ok(t1 && Math.abs(t1.long.abs - 0.4) < 1e-9 && Math.abs(t1.long.pct - 2.817) < 0.01, 'N1 long axis +0.4 mm, +2.8%');
ok(t1 && t1.volume.abs === 34 && Math.abs(t1.volume.pct - 2.881) < 0.01, 'N1 volume +34 mm³, +2.9%');
const t2 = p.tracks.find((t) => t.labels.join() === 'N2,N2');
ok(t2 && t2.volume == null && t2.volumeMissing, 'N2: follow-up outline not confirmed → no volume change');
const t3 = p.tracks.find((t) => t.key === 'b3');
ok(t3 && t3.notFoundAt === 1 && t3.long == null, 'N3 not found on the follow-up');
const tn = p.tracks.find((t) => t.key === 'f3');
ok(tn && tn.newAt === 1 && tn.cells[0] == null, 'follow-up N3 = new nodule');
ok(p.tracks.length === 4, `4 tracks (got ${p.tracks.length})`);
ok(!patientTracks([B, { ...F, scan_date: '2006-07-10' }], nods)[0].sameDay, 'different dates → not same-day');
const r = reviewBreakdown(nods);
ok(r.unchanged === 4 && r.edited === 1 && r.rejected === 1 && r.added === 1, `breakdown ${JSON.stringify(r)}`);
ok(r.measured === 6 && r.volumes === 4, `volumes recorded 4 of 6 (got ${r.volumes} of ${r.measured})`);
ok(unconfirmedOutlines(nods).map((n) => n.id).join() === 'f2,f3', 'reminder lists accepted nodules without a confirmed outline');
console.log(fail ? `${fail} failed` : 'all pass');
