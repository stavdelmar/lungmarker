import { uncertainty } from '@/lib/uncertainty';

// One colour rule for chips, image outlines and slice-bar marks.
// selected = teal · accepted = green · rejected = red dashed · AI unsure (undecided) = amber · other pending = grey
export function tone(n, selId) {
  if (n.id === selId) return 'selected';
  if (n.status === 'Rejected') return 'rejected';
  if (n.status === 'Accepted') return 'accepted';
  return uncertainty(n).unsure ? 'unsure' : 'pending';
}

export const STROKE = { selected: '#5eead4', accepted: '#34d399', rejected: '#f87171', unsure: '#fbbf24', pending: '#94a3b8' };