// Bug 17 Oct: RIDER-1332496276 Follow-up 1 showed N1, N1, N2, N2 (engine: 2 findings).
// Cause: the first-opening setup created the nodules whenever the page's own copy said "none yet", so two setups at
// the same time (two tabs after a reset, or a page re-mount mid-setup) both created the full set.
// Fix: setupScan (shared per tab + claim on the Scan + re-read before creating, only what's missing) and a clean-up.
import { base44 } from '@/api/base44Client';
import { initNodules, setupScan, setupScanUnshared, duplicateNodules } from '@/lib/initNodules';
import { removeDuplicates, resetScans } from '@/lib/reimport';
import { saveNodule } from '@/lib/edits';
const { Scan, Nodule, EditEvent } = base44.entities;
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };
const me = { user: { email: 'stav@x' }, initials: 'SD' };
const F = (id, z) => ({ finding_id: id, lobe: 'RUL', type_guess: 'Solid', key_slice_z: z, key_slice_number: z + 1, long_axis_mm: 12, short_axis_mm: 10, volume_mm3: 800, confidence: 0.9, flags: [],
  contours: { [z]: [[[0, 0], [10, 0], [10, 10], [0, 10]]] }, long_axis_px: [[0, 5], [10, 5]], short_axis_px: [[5, 0], [5, 10]], match: null });
const findings = [F('F1', 10), F('F2', 20)];
const nods = async (s) => (await Nodule.filter({ scan: s.id })).items;
const labels = async (s) => (await nods(s)).map((n) => n.nodule_label || `prior ${n.prior_label}`).sort().join(',');
const mk = (pid, tp = 'Follow-up 1') => Scan.create({ engine_scan_id: `${pid}_retest`, patient_id: pid, timepoint: tp, scan_date: '2006-01-10', review_status: 'Not started' });

// The old behaviour, reproduced: two setups that each saw "0 nodules" → N1, N1, N2, N2.
const old = await mk('OLD');
const sawNone = (await nods(old)).length === 0;
await Promise.all([initNodules(old, findings, []), sawNone && initNodules(old, findings, [])]);
ok(await labels(old) === 'N1,N1,N2,N2', `old setup twice → duplicates (got ${await labels(old)})`);

// 1. Same tab, page re-mounted while setup runs: calls share one setup.
const a = await mk('A');
const [r1, r2] = await Promise.all([setupScan(a, { findings, wait: 5 }), setupScan(a, { findings, wait: 5 })]);
ok(r1 === r2, 'two calls in one tab share the setup');
ok(await labels(a) === 'N1,N2', `same tab twice → N1, N2 (got ${await labels(a)})`);
ok((await Scan.get(a.id)).review_status === 'In review', 'scan In review after setup');

// 2. Two tabs at the same time (e.g. editor preview + live app after a reset): only the last claim goes on.
const b = await mk('B');
const res = await Promise.all([setupScanUnshared(b, { findings, wait: 5 }), setupScanUnshared(b, { findings, wait: 5 })]);
ok(await labels(b) === 'N1,N2', `two tabs → N1, N2 (got ${await labels(b)})`);
ok(res.filter((r) => r.skipped === 'set up by another tab').length === 1, `one tab stands down (${res.map((r) => r.skipped || `created ${r.created}`).join(' / ')})`);

// 3. A late second run that still thinks the scan is new (stale page): creates nothing that is already there.
const c = await mk('C');
await setupScanUnshared(c, { findings, wait: 0 });
await Scan.update(c.id, { review_status: 'Not started' }); // as a stale tab would see it
const late = await setupScanUnshared(c, { findings, wait: 0 });
ok(late.created === 0 && await labels(c) === 'N1,N2', `late re-run adds nothing (created ${late.created}, ${await labels(c)})`);
// … but a finding that really is missing is added, keeping its label from the full list
await Nodule.delete((await nods(c)).find((n) => n.nodule_label === 'N2').id);
await Scan.update(c.id, { review_status: 'Not started' });
ok((await setupScanUnshared(c, { findings, wait: 0 })).created === 1 && await labels(c) === 'N1,N2', 'only the missing finding is added back, as N2');

// 4. Follow-up "not found?" items are not duplicated either.
const prior = [{ nodule_label: 'N3', engine_finding_id: 'P3', status: 'Accepted', source: 'AI', kind: 'nodule', lobe: 'LLL' }];
const d = await mk('D');
await Promise.all([setupScanUnshared(d, { findings, matchSummary: { not_found_in_current: ['P3'] }, priorNodules: prior, wait: 5 }),
  setupScanUnshared(d, { findings, matchSummary: { not_found_in_current: ['P3'] }, priorNodules: prior, wait: 5 })]);
ok(await labels(d) === 'N1,N2,prior N3', `follow-up with a not-found prior, two tabs → N1, N2, prior N3 (got ${await labels(d)})`);

// 5. Re-import after setup: reset, then two tabs open it again → still one set.
await resetScans([await Scan.get(d.id)], me);
ok((await nods(d)).length === 0, 'reset removes the nodules');
await Promise.all([setupScanUnshared(await Scan.get(d.id), { findings, wait: 5 }), setupScanUnshared(await Scan.get(d.id), { findings, wait: 5 })]);
ok(await labels(d) === 'N1,N2', `re-import + two tabs → N1, N2 (got ${await labels(d)})`);

// 6. Clean-up of the existing duplicates: keep the copy with review work on it.
const dup = (await nods(old)).sort((x, y) => x.id.localeCompare(y.id, undefined, { numeric: true }));
const workedN1 = dup.filter((n) => n.nodule_label === 'N1')[1]; // the second copy is the one Stav reviewed
await saveNodule(old, workedN1, { status: 'Accepted', long_axis_mm: 13.1 }, me);
const plan = duplicateNodules(await nods(old));
ok(plan.remove.length === 2 && plan.keep.some((n) => n.id === workedN1.id), 'plan: remove 2, keep the reviewed N1');
const r = await removeDuplicates([await Scan.get(old.id)], me);
ok(r.nodules === 2 && await labels(old) === 'N1,N2', `removed 2 → N1, N2 (got ${await labels(old)})`);
ok((await nods(old)).find((n) => n.nodule_label === 'N1')?.long_axis_mm === 13.1, 'reviewed N1 kept with its edit');
const ev = (await EditEvent.filter({ scan: old.id })).items.find((e) => e.field === 'duplicates_removed');
ok(ev && /removed N1, N2/.test(ev.new_value), `trail row logged (${ev?.new_value})`);
ok((await removeDuplicates([await Scan.get(old.id)], me)).nodules === 0, 'running it again removes nothing');
ok(duplicateNodules(await nods(a)).remove.length === 0, 'clean scans have no duplicates');
console.log(fail ? `${fail} failed` : 'all pass');
