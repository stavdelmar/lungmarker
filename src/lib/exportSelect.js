import { base44 } from '@/api/base44Client';

// A row (accepted nodule on an approved scan) still has to go to Daniel's master sheet when it was
// never exported, or when it changed after its last export.
export const isPendingExport = (n) => !n.exported_at || !!n.changed_after_export;

// What goes into one export: the given rows (optionally only pending ones), their scans,
// and the trail events for those rows plus scan-level events (approval) of those scans.
export function selectForExport({ scans, nodules, events, onlyPending }) {
  const rows = onlyPending ? nodules.filter(isPendingExport) : nodules;
  const scanIds = new Set(rows.map((n) => n.scan));
  const rowIds = new Set(rows.map((n) => n.id));
  return {
    scans: scans.filter((s) => scanIds.has(s.id)),
    nodules: rows,
    events: events.filter((ev) => scanIds.has(ev.scan) && (!ev.nodule || rowIds.has(ev.nodule))),
  };
}

// Stamps the exported rows (reviewers only; the Results page checks the role).
export async function markExported(nodules, at = new Date().toISOString()) {
  if (!nodules.length) return;
  await base44.entities.Nodule.bulkUpdate(nodules.map((n) => ({ id: n.id, exported_at: at, changed_after_export: false })));
}

export { sortKey } from '@/lib/exportRows';
