import { base44 } from '@/api/base44Client';

// A row (accepted nodule on an approved scan) still has to go to Daniel's master sheet when it was
// never exported, or when it changed after its last export.
export const isPendingExport = (n) => !n.exported_at || !!n.changed_after_export;

// Status tag on Results: never exported / exported (date) / changed since its last export.
export const exportStatus = (n) => (n.changed_after_export ? 'changed' : n.exported_at ? 'exported' : 'new');

// Results selection: a row is pre-selected when it first appears in a state that still has to go to the sheet
// (new, or changed since export — also when an exported row changes later); otherwise the checkboxes decide.
// `seen` holds "id:status" keys. Returns the new selection and seen sets.
export function preselect(rows, selected, seen) {
  const sel = new Set(selected), saw = new Set(seen);
  rows.forEach((n) => { const k = `${n.id}:${exportStatus(n)}`; if (!saw.has(k)) { saw.add(k); if (isPendingExport(n)) sel.add(n.id); } });
  return { selected: sel, seen: saw };
}

// What goes into one export: the given rows (optionally only pending ones), their scans, the rejected findings of
// those scans not exported yet (trail only: AI draft + "Rejected: reason", never in Measurements), and the trail
// events for all of these plus the scan-level events (approval, central check) of those scans.
export function selectForExport({ scans, nodules, events, onlyPending, rejected = [] }) {
  const rows = onlyPending ? nodules.filter(isPendingExport) : nodules;
  const scanIds = new Set(rows.map((n) => n.scan));
  const rej = rejected.filter((n) => scanIds.has(n.scan) && isPendingExport(n));
  const ids = new Set([...rows, ...rej].map((n) => n.id));
  return {
    scans: scans.filter((s) => scanIds.has(s.id)),
    nodules: rows,
    rejected: rej,
    events: events.filter((ev) => scanIds.has(ev.scan) && (!ev.nodule || ids.has(ev.nodule))),
  };
}

// Stamps the exported rows (reviewers only; the Results page checks the role).
export async function markExported(nodules, at = new Date().toISOString()) {
  if (!nodules.length) return;
  await base44.entities.Nodule.bulkUpdate(nodules.map((n) => ({ id: n.id, exported_at: at, changed_after_export: false })));
}

export { sortKey } from '@/lib/exportRows';
