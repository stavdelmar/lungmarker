import { base44 } from '@/api/base44Client';
import { meanOf } from '@/lib/geometry';

const AI_KEY = { lobe: 'lobe', type: 'type', slice_number: 'key_slice_number', long_axis_mm: 'long', short_axis_mm: 'short', volume_mm3: 'volume', key_contour_px: 'contour', match_to_prior: 'match_label' };
const SKIP = ['long_axis_px', 'short_axis_px', 'mean_diameter_mm', 'was_edited', 'outline_confirmed_by_initials', 'outline_confirmed_at', 'key_slice_z', 'volume_stale'];
export const AI_FIELDS = ['lobe', 'type', 'slice_number', 'long_axis_mm', 'short_axis_mm', 'solid_component_mm', 'volume_mm3', 'outline'];

export function fmtVal(key, v) {
  if (v == null || v === '') return '';
  if (key === 'key_contour_px') return `${v.length} points`;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function eventBase(scan, nodule, me) {
  return {
    scan: scan.id, nodule: nodule?.id || '', engine_scan_id: scan.engine_scan_id, nodule_label: nodule?.nodule_label || '',
    edited_by_email: me.user.email, edited_by_initials: me.initials, edited_at: new Date().toISOString(),
  };
}

export function logEvent(scan, nodule, field, oldV, newV, me) {
  return base44.entities.EditEvent.create({ ...eventBase(scan, nodule, me), field, ai_value: '', old_value: oldV ?? '', new_value: newV ?? '' });
}

export async function saveNodule(scan, nodule, patch, me, { source } = {}) {
  const p = { ...patch };
  if ('long_axis_mm' in p || 'short_axis_mm' in p)
    p.mean_diameter_mm = meanOf(p.long_axis_mm ?? nodule.long_axis_mm, p.short_axis_mm ?? nodule.short_axis_mm);
  const outlineChanged = 'key_contour_px' in p && JSON.stringify(p.key_contour_px) !== JSON.stringify(nodule.key_contour_px);
  if (outlineChanged && nodule.outline_confirmed && !('outline_confirmed' in p)) {
    p.outline_confirmed = false; p.outline_confirmed_by_initials = ''; p.outline_confirmed_at = null;
  }
  const base = eventBase(scan, nodule, me);
  const events = [];
  Object.keys(p).forEach((k) => {
    if (SKIP.includes(k)) return;
    if (JSON.stringify(nodule[k] ?? null) === JSON.stringify(p[k] ?? null)) return;
    const field = k === 'key_contour_px' ? 'outline' : k;
    events.push({
      ...base, field, ai_value: fmtVal(k, nodule.ai_draft?.[AI_KEY[k]]), old_value: fmtVal(k, nodule[k]), new_value: fmtVal(k, p[k]),
      ...(source && field === 'outline' ? { source } : {}),
    });
  });
  if (!events.length) return;
  if (events.some((e) => AI_FIELDS.includes(e.field))) p.was_edited = true;
  await base44.entities.Nodule.update(nodule.id, p);
  await base44.entities.EditEvent.bulkCreate(events);
}