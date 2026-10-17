// Bug 1 (Stav, 17 Oct): a prior nodule must never silently disappear from a follow-up.
// FU N1 was matched to Baseline N2 instead of the AI's suggestion (Baseline N1) → Baseline N1 was neither matched nor
// asked "Not found?". The rule is recomputed live from Daniel's matches and blocks Approve until it holds.
import { priorCoverage, approveBlockers } from '@/lib/reviewChecks';
import { notFoundItemFor } from '@/lib/initNodules';
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };
const P = (label, o = {}) => ({ id: 'p' + label, nodule_label: label, status: 'Accepted', kind: 'nodule', lobe: 'RUL', type: 'Solid', source: 'AI', engine_finding_id: 'F' + label.slice(1), long_axis_mm: 10, ...o });
const C = (label, o = {}) => ({ id: 'c' + label, nodule_label: label, status: 'Accepted', kind: 'nodule', lobe: 'RUL', type: 'Solid', match_to_prior: '', ...o });
const prior = [P('N1'), P('N2'), P('N3', { status: 'Rejected' }), { id: 'px', kind: 'prior_not_found', prior_label: 'N9', status: 'Accepted' }];
const labels = (xs) => xs.map((p) => p.nodule_label).join(',');

// Stav's case: AI suggested N1, Daniel picked N2 → prior N1 unaccounted
let cur = [C('N1', { match_to_prior: 'N2' }), C('N2', { match_to_prior: 'N/A' })];
let u = priorCoverage(prior, cur);
ok(labels(u) === 'N1', `Stav's case → prior N1 unaccounted (got ${labels(u)})`);
let b = approveBlockers(cur, true, u);
ok(!b.ok && b.why === 'prior N1 not matched or confirmed not found', `Approve blocked with the reason (got "${b.why}")`);
// rejected prior nodules and the prior's own not-found rows are not required
ok(!u.some((p) => p.nodule_label === 'N3' || p.nodule_label === 'N9'), 'rejected / not-found prior rows not required');
// confirming "Not found" for prior N1 → accounted
cur = [...cur, { id: 'nf1', kind: 'prior_not_found', prior_label: 'N1', status: 'Accepted', match_to_prior: 'Not found' }];
ok(priorCoverage(prior, cur).length === 0 && approveBlockers(cur, true, priorCoverage(prior, cur)).ok, 'confirmed Not found → OK');
// "It's here" (item rejected) without marking it → still unaccounted
cur[2] = { ...cur[2], status: 'Rejected', reject_reason: 'Seen in this scan' };
ok(labels(priorCoverage(prior, cur)) === 'N1', '"It\'s here" without a match → still unaccounted');
// matching a nodule to N1 accounts for it; a pending nodule counts as a match but blocks as "not decided"
cur.push(C('N3', { match_to_prior: 'N1', status: 'Pending' }));
u = priorCoverage(prior, cur); b = approveBlockers(cur, true, u);
ok(u.length === 0 && !b.ok && b.why === '1 not decided yet', `pending match: covered, blocked as not decided (got "${b.why}")`);
// rejecting the nodule that carried the match → prior N1 unaccounted again (live)
cur[3] = { ...cur[3], status: 'Rejected', reject_reason: 'Vessel' };
ok(labels(priorCoverage(prior, cur)) === 'N1', 'rejecting the matching nodule re-opens the rule');
// changing a match away (N2 → N1) uncovers N2
cur = [C('N1', { match_to_prior: 'N1' }), C('N2', { match_to_prior: 'N/A' })];
ok(labels(priorCoverage(prior, cur)) === 'N2', 'moving a match uncovers the other prior');
// every reason at once
b = approveBlockers([C('N1', { match_to_prior: 'N1', lobe: '' }), C('N2', { status: 'Pending' })], false, [P('N2')]);
ok(b.why === '1 not decided yet · N1: no lobe · prior N2 not matched or confirmed not found', `all reasons (got "${b.why}")`);
// baseline: no prior → nothing required
ok(priorCoverage([], [C('N1')]).length === 0, 'baseline: nothing required');
// the live item: a regular "Not found in this scan?" item for that prior
const it = notFoundItemFor({ id: 's2', engine_scan_id: 'S_retest' }, P('N1'));
ok(it.kind === 'prior_not_found' && it.prior_label === 'N1' && it.status === 'Pending' && it.lobe === 'RUL' && it.ai_draft.unmatched && it.ai_draft.from_engine === false, 'live item = Pending not-found item for prior N1');
console.log(fail ? `${fail} failed` : 'all pass');
