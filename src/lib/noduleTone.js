import { uncertainty } from '@/lib/uncertainty';

// One colour rule for chips, image outlines and slice-bar marks.
// Colour = state only (selection is shown by shape: ring / thicker line / longer mark).
// accepted = green · rejected = red dashed · AI unsure (undecided) = amber · other pending = grey
export function tone(n) {
  if (n.status === 'Rejected') return 'rejected';
  if (n.status === 'Accepted') return 'accepted';
  return uncertainty(n).unsure ? 'unsure' : 'pending';
}

// pending = mid-grey (slate-500): never near-white, so a pending outline can't look selected (Stav, 17 Oct)
export const STROKE = { accepted: '#34d399', rejected: '#f87171', unsure: '#fbbf24', pending: '#64748b' };

// Image outline style. Colour = state for every nodule (same tone as chips and slice-bar marks); only the selected
// nodule gets a thicker, brighter line (thicker still on its first / last outlined slice). Every outline sits on a
// thin dark underlay so the colour stays readable over bright tissue (a 1 px line at reduced opacity vanished on a
// white nodule edge). Widths are screen pixels.
export function outlineStyle(n, { selected = false, end = false } = {}) {
  const t = tone(n);
  return {
    tone: t, stroke: STROKE[t],
    width: selected ? (end ? 3.5 : 2.75) : 1.5,
    underlay: selected ? (end ? 6 : 5) : 3.5,
    brighten: selected,
    dashed: t === 'rejected',
  };
}

// Slice-bar marks: one per nodule with a key slice; colour = state (tone), the selected one is longer/thicker
// (same colour). Rejected nodules only when "Show rejected" is on; "not found" items have no slice → no mark.
export function sliceTicks(nodules, selId, showRejected) {
  return nodules
    .filter((x) => x.kind !== 'prior_not_found' && x.key_slice_z != null && (showRejected || x.status !== 'Rejected'))
    .map((x) => ({ id: x.id, z: x.key_slice_z, label: x.nodule_label, color: tone(x), sel: x.id === selId }));
}
