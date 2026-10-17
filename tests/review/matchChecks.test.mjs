// Item 3 (Stav, 17 Oct): soft warning when a match looks implausible.
import { matchWarnings, matchesToCheck, gateMm } from '@/lib/matchChecks';
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };
const prior = [
  { nodule_label: 'N1', lobe: 'RUL', long_axis_mm: 14.2 },
  { nodule_label: 'N2', lobe: 'LLL', long_axis_mm: 6.3 },
];
const cur = (o) => ({ id: 'c1', nodule_label: 'N1', lobe: 'RUL', long_axis_mm: 14.6, status: 'Accepted', ai_draft: { match_label: 'N1', match: { prior_finding_id: 'F1', distance_mm: 3.1 } }, ...o });
const kinds = (w) => w.map((x) => x.kind).join(',');
// plausible: same lobe, +3%, the AI's pair at 3.1 mm
ok(matchWarnings(cur(), 'N1', prior).length === 0, 'AI pair, same lobe, similar size → no warning');
// Stav's case: FU N1 matched to Baseline N2 instead of the AI's N1 → lobe, size and position all flag it
let w = matchWarnings(cur({ match_to_prior: 'N2' }), 'N2', prior);
ok(kinds(w) === 'lobe,size,position', `Stav's case → lobe,size,position (got ${kinds(w)})`);
ok(w[0].text === 'Different lobe: RUL here, LLL on the prior.', w[0].text);
ok(w[1].text === 'Long axis 14.6 mm vs 6.3 mm on the prior (+132%).', w[1].text);
ok(w[2].text === "The AI's registration places prior N1 here, not N2 (N1 is 3.1 mm away after registration).", w[2].text);
// size threshold: exactly 50% no, just over yes; shrinking counts too
ok(!matchWarnings(cur({ long_axis_mm: 21.3, ai_draft: {} }), 'N1', prior).some((x) => x.kind === 'size'), '+50.0% → no size warning');
ok(matchWarnings(cur({ long_axis_mm: 21.4, ai_draft: {} }), 'N1', prior).some((x) => x.kind === 'size'), '+50.7% → size warning');
ok(matchWarnings(cur({ long_axis_mm: 7.0, ai_draft: {} }), 'N1', prior).some((x) => x.kind === 'size'), '−51% → size warning');
// position: the AI's own pair beyond the engine gate
ok(gateMm(14.6) === 10.95, 'gate = max(10 mm, 0.75 × long axis)');
ok(kinds(matchWarnings(cur({ ai_draft: { match_label: 'N1', match: { distance_mm: 13.9 } } }), 'N1', prior)) === 'position', 'AI pair at 13.9 mm (> 10.95) → position warning');
// no AI suggestion → no position check (no registered position for that pair), but lobe/size still checked
ok(matchWarnings(cur({ ai_draft: {} }), 'N2', prior).every((x) => x.kind !== 'position'), 'no AI suggestion → no position warning');
// N/A, Not found, empty → nothing
ok(['N/A', 'Not found', ''].every((l) => matchWarnings(cur(), l, prior).length === 0), 'N/A / Not found / empty → nothing');
// same prior matched twice
const two = [cur({ match_to_prior: 'N1' }), cur({ id: 'c2', nodule_label: 'N2', lobe: 'RUL', long_axis_mm: 14, match_to_prior: 'N1', ai_draft: {} })];
ok(matchWarnings(two[0], 'N1', prior, two).some((x) => x.text === 'Prior N1 is also matched to N2.'), 'same prior twice → warning');
ok(matchesToCheck(two, prior).length === 2, 'both nodules listed to check');
ok(matchesToCheck([cur({ match_to_prior: 'N1' })], prior).length === 0, 'plausible match → nothing to check');
// unknown lobe → no lobe warning
ok(!matchWarnings(cur({ lobe: '' }), 'N2', prior).some((x) => x.kind === 'lobe'), 'no lobe → no lobe warning');
console.log(fail ? `${fail} failed` : 'all pass');
