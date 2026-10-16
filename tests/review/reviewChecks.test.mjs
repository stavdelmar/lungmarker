import { sortNodules, approveBlockers, nextItem, parseNum, CENTRAL } from '@/lib/reviewChecks';
import { creditTotal } from '@/hooks/useScanTimer';
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };
const N = (label, o = {}) => ({ id: label, nodule_label: label, status: 'Pending', lobe: 'RUL', type: 'Solid', ...o });
// 1. order by Nodule ID (was by slice: N1, N3, N2)
ok(sortNodules([N('N1'), N('N3'), N('N2'), N('N10'), { id: 'p2', kind: 'prior_not_found', prior_label: 'N2' }, { id: 'p1', kind: 'prior_not_found', prior_label: 'N1' }]).map((n) => n.id).join() === 'N1,N2,N3,N10,p1,p2', 'sort by ID');
// 2. approve blocked: undecided / missing lobe / central not checked
let b = approveBlockers([N('N1', { status: 'Accepted' }), N('N2')], true);
ok(!b.ok && b.why === '1 not decided yet' && b.firstOpen.id === 'N2', 'undecided blocks');
b = approveBlockers([N('N1', { status: 'Accepted' }), N('N3', { status: 'Accepted', lobe: '' })], true);
ok(!b.ok && b.why === 'N3: no lobe' && b.firstOpen.id === 'N3', 'missing lobe blocks: ' + b.why);
b = approveBlockers([N('N3', { status: 'Accepted', lobe: '', type: '' })], true);
ok(b.why === 'N3: no lobe or type', 'lobe and type: ' + b.why);
b = approveBlockers([N('N3', { status: 'Rejected', lobe: '' })], true);
ok(b.ok, 'rejected nodule needs no lobe');
b = approveBlockers([{ id: 'p', kind: 'prior_not_found', prior_label: 'N2', status: 'Accepted', lobe: '', type: '' }], true);
ok(b.ok, 'not-found row needs no lobe/type');
ok(!approveBlockers([N('N1', { status: 'Accepted' })], false).ok, 'central blocks');
ok(approveBlockers([N('N1', { status: 'Accepted' })], true).ok, 'all done → ok');
ok(approveBlockers([], true).ok && !approveBlockers([], false).ok, 'no nodules: only central');
// 3. Next goes to Central areas after the last nodule
const list = [N('N1', { status: 'Accepted' }), N('N2')];
ok(nextItem(list, 'N2', false) === CENTRAL, 'next from last nodule → central');
ok(nextItem(list, CENTRAL, false) === 'N2', 'next from central → open nodule');
ok(nextItem([N('N1'), N('N2')], 'N1', true) === 'N2', 'next open nodule');
ok(nextItem([N('N1', { status: 'Accepted' })], 'N1', true) === CENTRAL, 'all done → cycles');
// 4. numbers: comma and dot
ok(parseNum('5,3') === 5.3 && parseNum('4.8') === 4.8 && parseNum('') === null && parseNum('abc') === undefined, 'parseNum');
// 5. timer: total stops 5 min after the last input
const m = 60000;
ok(creditTotal(0, 2 * m, 0) === 2 * m, 'active 2 min credited');
ok(creditTotal(0, 116 * m, 2 * m) === 7 * m, '116 min open, last input at 2 min → 7 min');
ok(creditTotal(10 * m, 116 * m, 2 * m) === 0, 'nothing after cut-off');
// simulate a session: ticks every second for 116 min, input only during the first 2 min → 7 min total
let total = 0, last = 0, input = 0;
for (let t = 1000; t <= 116 * m; t += 1000) { if (t <= 2 * m) input = t; total += creditTotal(last, t, input); last = t; }
ok(Math.round(total / m) === 7, 'session total ' + total / m);
// throttled background tab: one tick per minute still gives the same answer
total = 0; last = 0; input = 0;
for (let t = m; t <= 116 * m; t += m) { if (t <= 2 * m) input = t; total += creditTotal(last, t, input); last = t; }
ok(Math.round(total / m) === 7, 'throttled total ' + total / m);
console.log(fail ? `${fail} failed` : 'all pass');
