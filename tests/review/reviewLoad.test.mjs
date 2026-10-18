// Stav, 18 Oct: opening a scan briefly showed "NODULES (0)", "The AI found no nodules", "prior N1, N2 not matched"
// and slice #1 (neck) — drawn from data that hadn't loaded yet. reviewLoadState decides when the page may show the
// list, the empty state, the Approve warnings and start the timer. Walks through a real first opening, step by step.
// Run: node --import ./tests/export/register.mjs tests/review/reviewLoad.test.mjs
import { reviewLoadState, openingSlice } from '@/lib/reviewLoad';
import { approveBlockers, priorCoverage } from '@/lib/reviewChecks';
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };

const fu = (status = 'Not started') => ({ id: 's2', timepoint: 'Follow-up 1', review_status: status });
const meta = { n_slices: 300 }, findings = { findings: [{ finding_id: 'F1', key_slice_z: 150 }] };
const prior = { scan: { id: 's1', review_status: 'Approved' }, nodules: [{ nodule_label: 'N1', status: 'Accepted' }, { nodule_label: 'N2', status: 'Accepted' }] };
const N = [{ id: 'a', nodule_label: 'N1', key_slice_z: 152, match_to_prior: '' }, { id: 'b', nodule_label: 'N2', key_slice_z: 201, match_to_prior: '' }];
const base = { isReviewer: true, priorId: 'P_test', waitForPrior: false, engineError: false };

// The opening of a follow-up, in the order the data arrives. Each step = what the page knows at that moment.
const steps = [
  ['scan not loaded', { ...base }],
  ['scan loaded, patient scans not yet', { ...base, scan: fu() }],
  ['patient scans in, prior not yet', { ...base, scan: fu(), patientScans: [] }],
  ['prior in, engine files not yet', { ...base, scan: fu(), patientScans: [], prior }],
  ['everything in, AI draft being copied (setup) — the moment of the bug', { ...base, scan: fu(), patientScans: [], prior, meta, findings, nodules: [], nodulesFetching: false }],
  ['setup done, scan refetched, nodule list still the stale empty one', { ...base, scan: fu('In review'), patientScans: [], prior, meta, findings, nodules: [], nodulesFetching: true }],
];
for (const [name, s] of steps) {
  const st = reviewLoadState(s);
  ok(st === 'loading', `${name} → loading (got ${st})`);
  // What the OLD page showed at this moment: empty list + "prior N1, N2 not matched" warnings.
  if (s.nodules) {
    const unacc = priorCoverage(prior.nodules, s.nodules);
    ok(unacc.length === 2 && !approveBlockers(s.nodules, false, unacc).ok, `  (the warning the old page flashed here: ${unacc.length} prior nodules "not matched")`);
  }
}
const done = { ...base, scan: fu('In review'), patientScans: [], prior, meta, findings, nodules: N, nodulesFetching: false };
ok(reviewLoadState(done) === 'ready', 'nodules fetched after setup → ready');
ok(priorCoverage(prior.nodules, N.map((n, i) => ({ ...n, match_to_prior: `N${i + 1}`, status: 'Accepted' }))).length === 0, '  (and once matched, no prior nodule is unaccounted)');

// Once ready, background refetches after each save don't bring the loading state back.
ok(reviewLoadState({ ...done, wasReady: true, nodulesFetching: true }) === 'ready', 'refetch after a save → stays ready (no flash)');

// "The AI found no nodules" only when loading finished and the list is really empty.
const empty = { ...base, priorId: null, scan: { id: 's3', timepoint: 'Baseline', review_status: 'In review' }, patientScans: [], meta, findings: { findings: [] }, nodules: [], nodulesFetching: false };
ok(reviewLoadState(empty) === 'ready', 'really no nodules, everything loaded → ready (empty state may show)');
ok(reviewLoadState({ ...empty, nodulesFetching: true }) === 'loading', 'list still being fetched → not yet');
ok(reviewLoadState({ ...empty, meta: undefined }) === 'loading', 'image info not yet → not yet');

// Baseline without a prior doesn't wait for one.
ok(reviewLoadState({ ...empty, nodules: N }) === 'ready', 'baseline: no prior to wait for');
// A follow-up whose prior link comes from the patient's scans waits for those first.
ok(reviewLoadState({ ...done, patientScans: undefined }) === 'loading', 'prior link unknown until the patient scans are in');

// Engine unreachable: a scan that still needs its AI draft is an error, not "no nodules"; a set-up scan still shows.
ok(reviewLoadState({ ...base, scan: fu(), patientScans: [], prior, engineError: true }) === 'error', 'engine down before setup → error, not an empty list');
ok(reviewLoadState({ ...base, scan: fu('Approved'), patientScans: [], prior, engineError: true, nodules: N, nodulesFetching: false }) === 'ready', 'engine down on an approved scan → its saved nodules still show');

// Waiting for the prior's approval is a deliberate card, not loading; read-only viewers don't wait for a setup.
ok(reviewLoadState({ ...base, scan: fu(), patientScans: [], prior: { scan: { review_status: 'In review' }, nodules: [] }, waitForPrior: true }) === 'ready', 'waiting for prior approval → its card shows');
ok(reviewLoadState({ ...base, isReviewer: false, scan: fu(), patientScans: [], prior, meta, findings, nodules: [], nodulesFetching: false }) === 'ready', 'viewer on a not-started scan → no setup to wait for');

// Opening slice: first nodule's key slice; no nodules → middle of the scan, never slice #1.
ok(openingSlice(N, 300) === 152, 'opens on N1\'s key slice');
ok(openingSlice([{ kind: 'prior_not_found', key_slice_z: null }, ...N], 300) === 152, 'a "not found?" item has no slice → the first real nodule');
ok(openingSlice([], 300) === 149 && openingSlice(undefined, 40) === 19, 'no nodules → middle of the scan');
ok(openingSlice([], 1) === 0, 'one-slice scan → 0');
console.log(fail ? `${fail} failed` : 'all pass');
