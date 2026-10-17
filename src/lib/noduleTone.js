import { uncertainty } from '@/lib/uncertainty';

// One colour rule for chips, image outlines and slice-bar marks.
// Colour = state only (selection is shown by shape: ring / thicker line / longer mark).
// accepted = green · rejected = red dashed · AI unsure (undecided) = amber · other pending = grey
export function tone(n) {
  if (n.status === 'Rejected') return 'rejected';
  if (n.status === 'Accepted') return 'accepted';
  return uncertainty(n).unsure ? 'unsure' : 'pending';
}

export const STROKE = { accepted: '#34d399', rejected: '#f87171', unsure: '#fbbf24', pending: '#94a3b8' };

// Slice-bar marks: one per nodule with a key slice; colour = state (tone), the selected one is longer/thicker
// (same colour). Rejected nodules only when "Show rejected" is on; "not found" items have no slice → no mark.
export function sliceTicks(nodules, selId, showRejected) {
  return nodules
    .filter((x) => x.kind !== 'prior_not_found' && x.key_slice_z != null && (showRejected || x.status !== 'Rejected'))
    .map((x) => ({ id: x.id, z: x.key_slice_z, label: x.nodule_label, color: tone(x), sel: x.id === selId }));
}
