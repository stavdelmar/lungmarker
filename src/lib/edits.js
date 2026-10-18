import { base44 } from '@/api/base44Client';
import { meanOf } from '@/lib/geometry';
import { minutesOnScan } from '@/lib/minutes';

const AI_KEY = { lobe: 'lobe', type: 'type', slice_number: 'key_slice_number', long_axis_mm: 'long', short_axis_mm: 'short', solid_component_mm: 'solid', volume_mm3: 'volume', key_contour_px: 'contour', match_to_prior: 'match_label' };
const SKIP = ['exported_at', 'changed_after_export', 'long_axis_px', 'short_axis_px', 'mean_diameter_mm', 'was_edited', 'outline_confirmed_by_initials', 'outline_confirmed_at', 'key_slice_z', 'key_slice_manual', 'volume_stale'];
export const AI_FIELDS = ['lobe', 'type', 'slice_number', 'long_axis_mm', 'short_axis_mm', 'solid_component_mm', 'volume_mm3', 'outline'];

export function fmtVal(key, v) {
  if (v == null || v === '') return '';
  if (key === 'key_contour_px') return `${v.length} points`;
  if (key === 'contour_edits') return `${Object.keys(v).length} other slice(s) edited`;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function eventBase(scan, nodule, me) {
  return {
    scan: scan.id, nodule: nodule?.id || '', engine_scan_id: scan.engine_scan_id, nodule_label: nodule?.nodule_label || (nodule?.prior_label ? `prior ${nodule.prior_label}` : ''),
    edited_by_email: me.user.email, edited_by_initials: me.initials, edited_at: new Date().toISOString(),
    review_round: scan.review_round || 0, // a reset for re-import starts a new round; the export uses the current one
  };
}

// "Nothing" in any form (null, '', [], {}) — a change between two of these is not a change.
const isEmpty = (v) => v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
const same = (a, b) => (isEmpty(a) && isEmpty(b)) || JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function logEvent(scan, nodule, field, oldV, newV, me) {
  if (same(oldV, newV)) return Promise.resolve(null); // never log a non-change (e.g. "∅ → ∅")
  return base44.entities.EditEvent.create({ ...eventBase(scan, nodule, me), field, ai_value: '', old_value: oldV ?? '', new_value: newV ?? '' });
}

export async function saveNodule(scan, given, patch, me, { source, quiet = [] } = {}) {
  // Compare against the record as saved right now, not the page's copy: two quick edits of the same field
  // would otherwise both log the value from before the first edit ("8.5 → 8.3" instead of "39.2 → 8.3").
  let nodule = given;
  try { const fresh = await base44.entities.Nodule.get(given.id); if (fresh?.id) nodule = fresh; } catch { /* fall back to the given copy */ }
  const p = { ...patch };
  if ('long_axis_mm' in p || 'short_axis_mm' in p)
    p.mean_diameter_mm = meanOf(p.long_axis_mm ?? nodule.long_axis_mm, p.short_axis_mm ?? nodule.short_axis_mm);
  const outlineChanged = ('key_contour_px' in p && JSON.stringify(p.key_contour_px) !== JSON.stringify(nodule.key_contour_px))
    || ('contour_edits' in p && JSON.stringify(p.contour_edits) !== JSON.stringify(nodule.contour_edits));
  if (outlineChanged && nodule.outline_confirmed && !('outline_confirmed' in p)) {
    p.outline_confirmed = false; p.outline_confirmed_by_initials = ''; p.outline_confirmed_at = null;
  }
  const base = eventBase(scan, nodule, me);
  const events = [];
  Object.keys(p).forEach((k) => {
    if (SKIP.includes(k) || quiet.includes(k)) return; // quiet: saved, but described by another row (e.g. key slice moved)
    if (same(nodule[k], p[k])) return;
    const field = k === 'key_contour_px' || k === 'contour_edits' ? 'outline' : k;
    // An outline change is described by how it was made, since "16 points → 16 points" says nothing.
    const newV = field === 'outline' ? `${fmtVal(k, p[k])}, ${source || 'points moved by hand'}` : fmtVal(k, p[k]);
    const oldV = k === 'contour_edits' ? fmtVal(k, nodule[k] || {}) : fmtVal(k, nodule[k]);
    events.push({
      ...base, field, ai_value: fmtVal(k, nodule.ai_draft?.[AI_KEY[k]]), old_value: oldV, new_value: newV,
      ...(source && (field === 'outline' || field === 'slice_number') ? { source } : {}),
    });
  });
  if (!events.length) return;
  if (events.some((e) => AI_FIELDS.includes(e.field))) p.was_edited = true;
  if (nodule.exported_at) p.changed_after_export = true; // re-export it next time
  await base44.entities.Nodule.update(nodule.id, p);
  await base44.entities.EditEvent.bulkCreate(events);
}
// Approve a scan: stamps who/when and the timer's minutes, and logs it in the edit trail.
// Minutes on scan (exported, Daniel 17 Oct) = ACTIVE minutes: work without long breaks. The total time the scan
// was open (opening → approval) is kept as total_minutes, shown on screen and in the trail, labelled "open".
// Idempotent: a double click (or a second tab) must not approve twice or log "scan_approved" twice.
// Calls for the same scan while one is running share it; an already-approved scan is left as it is.
const approving = new Map();
export function approveScan(scan, secs, me, totalSecs) {
  if (approving.has(scan.id)) return approving.get(scan.id);
  const run = doApprove(scan, secs, me, totalSecs).finally(() => approving.delete(scan.id));
  approving.set(scan.id, run);
  return run;
}
async function doApprove(scan, secs, me, totalSecs) {
  let current = scan;
  try { const fresh = await base44.entities.Scan.get(scan.id); if (fresh?.id) current = fresh; } catch { /* use the page's copy */ }
  if (current.review_status === 'Approved') return null; // already approved: nothing to stamp or log
  scan = { ...scan, ...current };
  const total = Math.max(totalSecs ?? 0, secs);
  const patch = { review_status: 'Approved', approved_by_email: me.user.email, approved_by_initials: me.initials, approved_at: new Date().toISOString(),
    active_seconds: secs, total_seconds: total, active_minutes: Math.ceil(secs / 60), minutes_on_scan: Math.ceil(secs / 60), total_minutes: Math.ceil(total / 60) };
  await base44.entities.Scan.update(scan.id, patch);
  await logEvent(scan, null, 'scan_approved', 'In review', `Approved · Minutes on scan ${patch.minutes_on_scan} (active work) · open ${patch.total_minutes} min in total`, me);
  // Re-approval after a reopen can change Minutes on scan → already-exported rows of this scan go out again.
  const exported = minutesOnScan(scan) != null && minutesOnScan(scan) !== patch.minutes_on_scan
    ? (await base44.entities.Nodule.filter({ scan: scan.id, status: 'Accepted' }, { limit: 500 })).items.filter((n) => n.exported_at) : [];
  if (exported.length) await base44.entities.Nodule.bulkUpdate(exported.map((n) => ({ id: n.id, changed_after_export: true })));
  return patch;
}

// Required before approval: the reviewer checked the hilum / mediastinum (the AI's blind spot). Logged in the trail.
export async function markCentralChecked(scan, me, done = true) {
  const patch = done ? { central_checked_at: new Date().toISOString(), central_checked_by_initials: me.initials } : { central_checked_at: null, central_checked_by_initials: '' };
  await base44.entities.Scan.update(scan.id, patch);
  await logEvent(scan, null, 'central_areas_checked', done ? '' : 'yes', done ? 'yes' : 'undone', me);
  return patch;
}
