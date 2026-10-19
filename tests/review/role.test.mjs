// Bug in c857403 (Stav, 20 Oct): a user with no STORED app_role was shown as reviewer (UI default), setup tried to
// update the Scan, the server (RLS on the stored role) refused — "Permission denied for update operation on Scan
// entity" — and the scan never loaded. Fix: save the role on the user's own record first; only the stored role
// counts; a refused setup shows the scan read-only. Walks through a brand-new user against an RLS-like fake.
// Run: node --import ./tests/export/register.mjs tests/review/role.test.mjs
import { base44 } from '@/api/base44Client';
import { DEFAULT_ROLE, ensureRole, needsRole, storedRole } from '@/lib/role';
import { setupScan } from '@/lib/initNodules';
import { reviewLoadState } from '@/lib/reviewLoad';
const { Scan, Nodule } = base44.entities;
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };
const F = (id, z) => ({ finding_id: id, lobe: 'RUL', type_guess: 'Solid', key_slice_z: z, key_slice_number: z + 1, long_axis_mm: 12, short_axis_mm: 10, volume_mm3: 800, confidence: 0.9, flags: [],
  contours: { [z]: [[[0, 0], [10, 0], [10, 10], [0, 10]]] }, long_axis_px: [[0, 5], [10, 5]], short_axis_px: [[5, 0], [5, 10]], match: null });
const findings = [F('F1', 10), F('F2', 20)];
const newScan = (pid) => Scan.create({ engine_scan_id: `${pid}_test`, patient_id: pid, timepoint: 'Baseline', scan_date: '2006-01-10', review_status: 'Not started' });
const load = (s, over = {}) => reviewLoadState({ scan: s, isReviewer: false, patientScans: [], priorId: null, meta: {}, findings: { findings }, nodules: [], nodulesFetching: false, ...over });

// Scans exist before the permission check is switched on (made by an admin / the sync).
const s1 = await newScan('P1'), s2 = await newScan('P2'), s3 = await newScan('P3');
base44.__rls = true; // from here on: create / update on Scan, Nodule, EditEvent only with a STORED reviewer role

// 1. The bug, reproduced: a brand-new user (no app_role stored) that the UI treats as a reviewer.
let me = await base44.__signIn({ email: 'new@lab', full_name: 'New Person' });
ok(needsRole(me) && storedRole(me) === null, 'brand-new user: no role stored');
let err = null; try { await setupScan(s1, { findings, wait: 0 }); } catch (e) { err = e.message; }
ok(/Permission denied for update operation on Scan entity/.test(err || ''), `old path: setup refused by the server (${err})`);

// 2. The fix: the role is saved on the user's own record first (auth.updateMe), then `me` is re-read.
ok(await ensureRole(base44.auth, me) === DEFAULT_ROLE && DEFAULT_ROLE === 'reviewer', 'ensureRole saves "reviewer"');
me = await base44.auth.me();
ok(storedRole(me) === 'reviewer' && !needsRole(me), 'refetched user carries the stored role');
const r = await setupScan(s2, { findings, wait: 0 });
ok(r.created === 2 && (await Nodule.filter({ scan: s2.id })).items.length === 2, `setup now succeeds (created ${r.created})`);
ok((await Scan.get(s2.id)).review_status === 'In review', 'scan set up → In review');
ok(await ensureRole(base44.auth, me) === 'reviewer', 'second call: nothing to do');

// 3. While the role is being saved the page waits (no setup can start early).
ok(load(s3, { meLoading: true, isReviewer: false }) === 'loading', 'role being saved → loading (setup waits)');

// 4. A stored role is never overwritten: someone set back to viewer stays viewer.
let calls = 0; const spyAuth = { updateMe: async () => { calls++; return {}; } };
ok(await ensureRole(spyAuth, { id: 'u9', app_role: 'viewer' }) === 'viewer' && calls === 0, 'stored viewer kept, no save');

// 5. If the user can't save their own role: no endless "Loading" — read-only.
await base44.__signIn({ email: 'other@lab' });
base44.__denyUpdateMe = true;
let denied = null; try { await ensureRole(base44.auth, await base44.auth.me()); } catch (e) { denied = e.message; }
ok(/Permission denied/.test(denied || ''), `role save refused (${denied}) → useMe reports roleError, user stays read-only`);
ok(load(s3, { isReviewer: false }) === 'not-set-up', 'no stored role → not-set-up card (read-only), not "AI found no nodules"');
base44.__denyUpdateMe = false;

// 6. Any refused setup shows the scan read-only with the reason instead of loading forever.
ok(load(s3, { isReviewer: true, setupError: 'Permission denied for update operation on Scan entity' }) === 'setup-failed', 'setup refused → setup-failed (read-only)');
ok(load(s3, { isReviewer: true }) === 'loading', 'reviewer, setup still running → loading (unchanged)');
ok(load(s3, { isReviewer: true, wasReady: true, setupError: 'x' }) === 'ready', 'a scan that was ready stays ready');

base44.__rls = false;
console.log(fail ? `${fail} failed` : 'all pass');
