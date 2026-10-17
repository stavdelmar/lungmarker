// Slice-bar marks and image outlines are coloured by the nodule's state (Stav, 17 Oct):
// grey = pending, amber = AI unsure (only while undecided), green = accepted, red dashed = rejected (only with
// "Show rejected"); the selected nodule is shown by size, not by a different colour.
import { tone, sliceTicks, STROKE } from '@/lib/noduleTone';
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };
const N = (label, z, o = {}) => ({ id: label, nodule_label: label, key_slice_z: z, source: 'AI', status: 'Pending', flags: [], ai_confidence: 0.9, kind: 'nodule', ...o });
const scan = [N('N1', 10), N('N2', 20, { flags: ['low_confidence'], ai_confidence: 0.54 }), N('N3', 30), N('N4', 40, { source: 'Added by reviewer' }),
  { id: 'nf', kind: 'prior_not_found', prior_label: 'N9', status: 'Pending', key_slice_z: null }];

const t = sliceTicks(scan, 'N1', false);
ok(t.filter((x) => x.color === 'unsure').map((x) => x.label).join() === 'N2', `only the AI-unsure nodule is amber (got ${t.filter((x) => x.color === 'unsure').map((x) => x.label)})`);
ok(t.filter((x) => x.color === 'pending').map((x) => x.label).join() === 'N1,N3,N4', 'the others are grey (pending), the selected one included');
ok(t.find((x) => x.label === 'N1').sel && t.filter((x) => x.sel).length === 1, 'selection is a flag (size), not a colour');
ok(!t.some((x) => x.id === 'nf'), 'no mark for a "not found" item');
// decided → the amber goes
const decided = scan.map((n) => (n.id === 'N2' ? { ...n, status: 'Accepted' } : n.id === 'N3' ? { ...n, status: 'Rejected', reject_reason: 'Vessel' } : n));
const t2 = sliceTicks(decided, null, false);
ok(t2.find((x) => x.label === 'N2').color === 'accepted', 'AI-unsure nodule accepted → green, no longer amber');
ok(!t2.some((x) => x.label === 'N3'), 'rejected hidden when "Show rejected" is off');
ok(sliceTicks(decided, null, true).find((x) => x.label === 'N3').color === 'rejected', 'rejected shown (red dashed) with "Show rejected"');
ok(sliceTicks(scan.map((n) => (n.id === 'N2' ? { ...n, status: 'Rejected' } : n)), null, true).find((x) => x.label === 'N2').color === 'rejected', 'an AI-unsure nodule that is rejected is red, not amber');
// outlines use the same rule
ok(STROKE[tone(scan[1])] === '#fbbf24' && STROKE[tone(scan[0])] === '#94a3b8' && STROKE[tone(decided[1])] === '#34d399' && STROKE[tone(decided[2])] === '#f87171', 'outline colours follow the same states');
console.log(fail ? `${fail} failed` : 'all pass');
