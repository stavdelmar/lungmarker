// Slice-bar marks and image outlines are coloured by the nodule's state (Stav, 17 Oct):
// grey = pending, amber = AI unsure (only while undecided), green = accepted, red dashed = rejected (only with
// "Show rejected"); the selected nodule is shown by size, not by a different colour.
import { tone, sliceTicks, STROKE, outlineStyle } from '@/lib/noduleTone';
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
ok(STROKE[tone(scan[1])] === '#fbbf24' && STROKE[tone(scan[0])] === '#64748b' && STROKE[tone(decided[1])] === '#34d399' && STROKE[tone(decided[2])] === '#f87171', 'outline colours follow the same states');
// image outlines (Stav, 17 Oct: a non-selected AI-unsure N2 looked thick and white while its label was amber)
const o = (n, sel = false, end = false) => outlineStyle(n, { selected: sel, end });
const lum = (hex) => { const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
ok(o(scan[1]).stroke === '#fbbf24' && o(scan[1]).width === 1.5, 'non-selected AI-unsure → amber, thin');
ok(o(scan[0]).stroke === STROKE.pending && lum(o(scan[0]).stroke) < 0.5, `non-selected pending → mid-grey, not near-white (luminance ${lum(o(scan[0]).stroke).toFixed(2)})`);
ok(o(decided[1]).stroke === '#34d399' && o(decided[2]).dashed, 'accepted green, rejected dashed');
ok(o(scan[1], true).stroke === o(scan[1]).stroke && o(scan[1], true).width > o(scan[1]).width && o(scan[1], true).brighten, 'selected: same colour, thicker and brighter');
ok(o(scan[0], true, true).stroke === STROKE.pending, 'selected on its first / last slice: still its state colour (no white)');
ok(scan.filter((n) => n.kind !== 'prior_not_found').every((n) => o(n).width === 1.5 && !o(n).brighten), 'every non-selected outline is thin and not brightened');
ok(scan.filter((n) => n.kind !== 'prior_not_found').every((n) => o(n).stroke === STROKE[sliceTicks([n], null, true)[0].color]), 'outline colour = slice-bar mark colour for every nodule');
ok(o(scan[0]).underlay > o(scan[0]).width, 'dark underlay under every outline (readable on bright tissue)');

console.log(fail ? `${fail} failed` : 'all pass');
