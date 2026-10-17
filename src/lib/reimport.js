// Engine output changes (e.g. a new outline rule on S3) vs scans already imported into the app.
// What the app copies at a scan's first opening (nodules, ai_draft) is frozen; per-slice outlines and images are
// still read live. So: fingerprint the AI output at import, warn when it no longer matches, and offer a safe reset.
import { base44 } from '@/api/base44Client';
import { fetchAll } from '@/lib/data';
import { tpRank } from '@/lib/patients';
import { logEvent } from '@/lib/edits';
import { duplicateNodules } from '@/lib/initNodules';

const { Scan, Nodule } = base44.entities;

// Short stable fingerprint of a scan's findings.json (findings incl. outlines + match summary). FNV-1a over the JSON.
export function fingerprint(f) {
  if (!f) return '';
  const s = JSON.stringify({ findings: f.findings || [], match_summary: f.match_summary || null });
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${(f.findings || []).length}:${h.toString(16).padStart(8, '0')}`;
}

// 'not imported' (never opened: will use the current output) | 'unknown' (imported before fingerprints existed)
// | 'same' | 'changed'
export function engineState(scan, findingsJson) {
  if (!scan || scan.review_status === 'Not started') return 'not imported';
  if (!scan.ai_fingerprint) return 'unknown';
  if (!findingsJson) return 'unknown';
  return fingerprint(findingsJson) === scan.ai_fingerprint ? 'same' : 'changed';
}

// A follow-up's nodules, matches and "not found?" items come from its prior's review, so resetting a scan
// also resets the later timepoints of the same patient.
export function withLaterScans(targets, allScans) {
  const ids = new Set(targets.map((s) => s.id));
  targets.forEach((t) => allScans.forEach((s) => { if (s.patient_id === t.patient_id && tpRank(s.timepoint) > tpRank(t.timepoint)) ids.add(s.id); }));
  return allScans.filter((s) => ids.has(s.id));
}

// Back to "never reviewed". Kept: the scan record itself and its whole edit trail (append-only by design);
// the export only uses trail rows of the current review round (see liveEvents).
export const RESET_FIELDS = {
  review_status: 'Not started', active_seconds: 0, total_seconds: 0, active_minutes: null, minutes_on_scan: null,
  approved_by_email: '', approved_by_initials: '', approved_at: null, central_checked_at: null, central_checked_by_initials: '',
  resume_item_id: '', first_opened_at: null, exported_at: null, ai_fingerprint: '', ai_imported_at: null, setup_token: '',
};

// Admin only (deleting nodules is admin-only in the entity rules). engineScans = scans.json entries, used to refresh
// the scan's metadata (series, slices, prior link, number of findings) from the engine.
export async function resetScans(scans, me, { engineScans = [], reason = '' } = {}) {
  const meta = Object.fromEntries(engineScans.map((e) => [e.scan_id, e]));
  const out = { scans: 0, nodules: 0 };
  for (const s of scans) {
    const nods = await fetchAll(Nodule, { scan: s.id });
    for (const n of nods) await Nodule.delete(n.id);
    const e = meta[s.engine_scan_id];
    const fresh = e ? {
      series_number: e.series_number ?? s.series_number, slice_thickness_mm: e.slice_thickness_mm ?? s.slice_thickness_mm, n_slices: e.n_slices ?? s.n_slices,
      prior_engine_scan_id: e.prior_scan_id || s.prior_engine_scan_id || '', ai_findings_count: e.n_findings ?? null,
    } : {};
    const round = (s.review_round || 0) + 1;
    await Scan.update(s.id, { ...RESET_FIELDS, ...fresh, reset_at: new Date().toISOString(), review_round: round });
    await logEvent({ ...s, review_round: round }, null, 'scan_reset', s.review_status || 'Not started', `re-imported from engine${reason ? ` (${reason})` : ''}; earlier review discarded`, me);
    out.scans += 1; out.nodules += nods.length;
  }
  return out;
}

// Trail rows that belong to the current review of each scan: those written in its current review round (a reset
// starts a new round and its own row is the first of it). A counter, not a time comparison, so rows written in the
// same millisecond as the reset can't land on the wrong side. Rows from before rounds existed count as round 0.
export function liveEvents(scans, events) {
  const round = Object.fromEntries(scans.map((s) => [s.id, s.review_round || 0]));
  return events.filter((ev) => !(ev.scan in round) || (ev.review_round || 0) === round[ev.scan]);
}

// Admin only (deletes nodules). Removes duplicate copies of the same AI finding / prior "not found?" item that the
// old first-opening setup could create twice (see setupScan). One trail row per cleaned scan.
export async function removeDuplicates(scans, me) {
  const out = { scans: 0, nodules: 0, labels: [] };
  for (const s of scans) {
    const { remove } = duplicateNodules(await fetchAll(Nodule, { scan: s.id }));
    if (!remove.length) continue;
    for (const n of remove) await Nodule.delete(n.id);
    const labels = remove.map((n) => n.nodule_label || `prior ${n.prior_label}`).join(', ');
    await logEvent(s, null, 'duplicates_removed', `${remove.length} duplicate${remove.length === 1 ? '' : 's'}`, `removed ${labels} (same AI finding created twice when the scan was first set up); the reviewed copy kept`, me);
    out.scans += 1; out.nodules += remove.length; out.labels.push(`${s.patient_id} ${s.timepoint}: ${labels}`);
  }
  return out;
}
