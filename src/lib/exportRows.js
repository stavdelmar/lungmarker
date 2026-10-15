export const MEAS_HEADERS = ['Patient ID', 'Scan date', 'Timepoint', 'Series #', 'Slice thickness (mm)', 'Nodule ID', 'Lobe', 'Slice #', 'Type', 'Long axis (mm)', 'Short axis (mm)', 'Mean diameter (mm)', 'Solid component (mm)', 'Volume (mm3)', 'Match to prior', 'Minutes on scan', 'Measured by', 'Notes'];
export const TRAIL_HEADERS = ['Patient ID', 'Scan date', 'Timepoint', 'Nodule ID', 'Field', 'AI value', 'Previous value', 'New value', 'Changed by', 'Changed at'];
export const ONE_DEC_COLS = [9, 10, 11, 12];

const FIELD_NAMES = { long_axis_mm: 'long axis', short_axis_mm: 'short axis', outline: 'outline', lobe: 'lobe', type: 'type', volume_mm3: 'volume', solid_component_mm: 'solid component', slice_number: 'slice' };
const n1 = (v) => (v == null || v === '' ? '' : Number(Number(v).toFixed(1)));
const e = (v) => (v == null ? '' : v);
const d10 = (v) => (v ? String(v).slice(0, 10) : '');
const ts = (v) => (v ? new Date(v).toISOString().slice(0, 16).replace('T', ' ') : '');

function sortKey(s, n) { return `${s.patient_id}|${d10(s.scan_date)}|${String(n?.nodule_label || '').padStart(5, '0')}`; }

export function measurementRows(scans, nodules, events) {
  const sMap = Object.fromEntries(scans.map((s) => [s.id, s]));
  return nodules.filter((n) => sMap[n.scan]).sort((a, b) => sortKey(sMap[a.scan], a).localeCompare(sortKey(sMap[b.scan], b))).map((n) => {
    const s = sMap[n.scan];
    const edited = [...new Set(events.filter((ev) => ev.nodule === n.id && FIELD_NAMES[ev.field]).map((ev) => FIELD_NAMES[ev.field]))];
    const tag = n.source === 'AI' ? (edited.length ? `AI-assisted; edited: ${edited.join(', ')}` : 'AI-assisted; accepted unchanged') : 'Added by reviewer';
    return [
      e(s.patient_id), d10(s.scan_date), e(s.timepoint), e(s.series_number), e(s.slice_thickness_mm), e(n.nodule_label), e(n.lobe), e(n.slice_number), e(n.type),
      n1(n.long_axis_mm), n1(n.short_axis_mm), n1(n.mean_diameter_mm), n.type === 'Part-solid' ? n1(n.solid_component_mm) : '',
      n.outline_confirmed && !n.volume_stale && n.volume_mm3 != null ? Math.round(n.volume_mm3) : '',
      s.timepoint === 'Baseline' ? '' : e(n.match_to_prior), e(s.minutes_on_scan), e(s.approved_by_initials),
      [n.notes?.trim(), tag].filter(Boolean).join('; '),
    ];
  });
}

export function trailRows(scans, events) {
  const sMap = Object.fromEntries(scans.map((s) => [s.id, s]));
  return events.filter((ev) => sMap[ev.scan]).map((ev) => {
    const s = sMap[ev.scan];
    return [e(s.patient_id), d10(s.scan_date), e(s.timepoint), e(ev.nodule_label), ev.source ? `${ev.field} (${ev.source})` : e(ev.field), e(ev.ai_value), e(ev.old_value), e(ev.new_value), e(ev.edited_by_initials), ts(ev.edited_at)];
  });
}

export function toCsv(headers, rows) {
  const q = (v) => { const s = typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [headers, ...rows].map((r) => r.map(q).join(',')).join('\n');
}