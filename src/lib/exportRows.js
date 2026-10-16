export const MEAS_HEADERS = ['Patient ID', 'Scan date', 'Timepoint', 'Series #', 'Slice thickness (mm)', 'Nodule ID', 'Lobe', 'Slice #', 'Type', 'Long axis (mm)', 'Short axis (mm)', 'Mean diameter (mm)', 'Solid component (mm)', 'Volume (mm3)', 'Match to prior', 'Minutes on scan', 'Measured by', 'Notes'];
export const TRAIL_HEADERS = ['Patient ID', 'Scan date', 'Timepoint', 'Nodule ID', 'Field', 'AI value', 'Previous value', 'New value', 'Changed by', 'Changed at'];
export const ONE_DEC_COLS = [9, 10, 11, 12];

const FIELD_NAMES = { long_axis_mm: 'long axis', short_axis_mm: 'short axis', outline: 'outline', lobe: 'lobe', type: 'type', volume_mm3: 'volume', solid_component_mm: 'solid component', slice_number: 'slice' };
// Blank = null, so the Excel cell is really empty (not an empty-text cell). toCsv writes null as nothing.
const n1 = (v) => (v == null || v === '' ? null : Number(Number(v).toFixed(1)));
const e = (v) => (v == null || v === '' ? null : v);
const d10 = (v) => (v ? String(v).slice(0, 10) : null);
// Trail times in the exporting computer's local time ("yyyy-mm-dd hh:mm"), the time Daniel saw in the app.
// The workbook turns them into real Excel date-times; the Read me sheet names the time zone.
const pad = (x) => String(x).padStart(2, '0');
export const localStamp = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const ts = localStamp;
export const MIN_LONG_AXIS_MM = 4; // Daniel measures nodules of 4 mm and up
export const isNotFound = (n) => n.kind === 'prior_not_found';
// Rows that go to the sheet: measured nodules ≥ 4 mm, plus confirmed "not found" prior nodules (no size).
export const exportable = (n) => isNotFound(n) || Number(n.long_axis_mm) >= MIN_LONG_AXIS_MM;

// Group rows by scan (patient, date, Baseline before Follow-up 1, …), then N1, N2, … within the scan.
const tpRank = (t = '') => (t === 'Baseline' ? 0 : parseInt(String(t).replace(/\D/g, ''), 10) || 99);
export function sortKey(s, n) { return `${s.patient_id}|${d10(s.scan_date)}|${String(tpRank(s.timepoint)).padStart(3, '0')}|${n && isNotFound(n) ? 'z' : 'a'}${String(n?.nodule_label || n?.prior_label || '').replace(/\d+/, (d) => d.padStart(4, '0'))}`; }

export function measurementRows(scans, nodules, events) {
  const sMap = Object.fromEntries(scans.map((s) => [s.id, s]));
  return nodules.filter((n) => sMap[n.scan] && exportable(n)).sort((a, b) => sortKey(sMap[a.scan], a).localeCompare(sortKey(sMap[b.scan], b))).map((n) => {
    const s = sMap[n.scan];
    if (isNotFound(n)) {
      // A prior nodule not found on this follow-up: no measurements, Match to prior = "Not found", Daniel's note.
      return [e(s.patient_id), d10(s.scan_date), e(s.timepoint), e(s.series_number), e(s.slice_thickness_mm), null, e(n.lobe), null, null,
        null, null, null, null, null, 'Not found', e(s.minutes_on_scan), e(s.approved_by_initials), e(n.notes?.trim())];
    }
    return [
      e(s.patient_id), d10(s.scan_date), e(s.timepoint), e(s.series_number), e(s.slice_thickness_mm), e(n.nodule_label), e(n.lobe), e(n.slice_number), e(n.type),
      n1(n.long_axis_mm), n1(n.short_axis_mm), n1(n.mean_diameter_mm), n.type === 'Part-solid' ? n1(n.solid_component_mm) : null,
      n.outline_confirmed && n.volume_mm3 != null ? Math.round(n.volume_mm3) : null,
      s.timepoint === 'Baseline' ? null : e(n.match_to_prior), e(s.minutes_on_scan), e(s.approved_by_initials),
      e(n.notes?.trim()),  // Daniel's own text only
    ];
  });
}

const v1 = (v) => (v == null || v === '' ? '–' : Number(v).toFixed(1));
// One "AI draft" row per exported nodule (what the AI proposed, before any edit), then every change in time order.
// How each exported nodule was reviewed (was in Notes; Notes is now Daniel's text only).
export function reviewResult(n, events) {
  if (isNotFound(n)) return `Prior ${n.prior_label} confirmed not found in this scan`;
  if (n.source !== 'AI') return 'Added by reviewer';
  const edited = [...new Set(events.filter((ev) => ev.nodule === n.id && FIELD_NAMES[ev.field]).map((ev) => FIELD_NAMES[ev.field]))];
  return edited.length ? `AI-assisted; edited: ${edited.join(', ')}` : 'AI-assisted; accepted unchanged';
}

export function trailRows(scans, events, nodules = []) {
  const sMap = Object.fromEntries(scans.map((s) => [s.id, s]));
  const head = (s, label) => [e(s.patient_id), d10(s.scan_date), e(s.timepoint), e(label)];
  const drafts = nodules.filter((n) => sMap[n.scan] && exportable(n)).sort((a, b) => sortKey(sMap[a.scan], a).localeCompare(sortKey(sMap[b.scan], b))).map((n) => {
    const s = sMap[n.scan], a = n.ai_draft || {};
    const label = isNotFound(n) ? `prior ${n.prior_label}` : n.nodule_label;
    const result = [...head(s, label), 'Review result', null, null, reviewResult(n, events), e(s.approved_by_initials), ts(s.approved_at)];
    if (isNotFound(n)) {
      const why = n.ai_draft?.from_engine ? `prior ${n.prior_label} not found in this scan (engine matching)` : `prior ${n.prior_label} was added by hand; the AI cannot match it`;
      return [[...head(s, label), 'AI draft', why, null, null, `AI engine ${s.engine_version || ''}`.trim(), ts(n.created_date)], result];
    }
    if (n.source !== 'AI') return [[...head(s, n.nodule_label), 'AI draft', 'none (added by reviewer)', null, null, e(s.engine_version) ? `AI engine ${s.engine_version}` : 'AI engine', ts(n.created_date)], result];
    const match = a.match_label ? `suggested match ${a.match_label}` : s.timepoint === 'Baseline' ? null : 'no match suggested';
    const summary = [a.lobe, a.type, `slice ${a.key_slice_number ?? '–'}`, `long ${v1(a.long)} × short ${v1(a.short)} mm`, a.solid != null ? `solid ${v1(a.solid)} mm` : null, a.volume != null ? `volume ${Math.round(a.volume)} mm3` : null, `outline ${(a.contour || []).length} points`, match].filter(Boolean).join('; ');
    return [[...head(s, n.nodule_label), 'AI draft', summary, null, null, `AI engine ${s.engine_version || ''}`.trim(), ts(n.created_date)], result];
  }).flat();
  const changes = events.filter((ev) => sMap[ev.scan]).sort((a, b) => (sortKey(sMap[a.scan], { nodule_label: '' }) + a.edited_at).localeCompare(sortKey(sMap[b.scan], { nodule_label: '' }) + b.edited_at)).map((ev) => {
    const s = sMap[ev.scan];
    return [...head(s, ev.nodule_label), ev.source ? `${ev.field} (${ev.source})` : e(ev.field), e(ev.ai_value), e(ev.old_value), e(ev.new_value), e(ev.edited_by_initials), ts(ev.edited_at)];
  });
  return [...drafts, ...changes];
}

export function toCsv(headers, rows) {
  const q = (v) => { if (v == null) return ''; const s = typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [headers, ...rows].map((r) => r.map(q).join(',')).join('\n');
}