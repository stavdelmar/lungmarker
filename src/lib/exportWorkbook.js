import { MEAS_HEADERS, TRAIL_HEADERS, ONE_DEC_COLS, measurementRows, trailRows } from '@/lib/exportRows';
import { liveEvents } from '@/lib/reimport';

// Date text → a real Excel date (sorts and filters as a date). Column c of rows 1…nRows:
// "yyyy-mm-dd" → shown yyyy-mm-dd (Scan date, column B); "yyyy-mm-dd hh:mm" → shown yyyy-mm-dd hh:mm
// (Edit trail "Changed at", local time; Excel has no time zones).
function datesToExcel(XLSX, ws, nRows, c = 1) {
  for (let r = 1; r <= nRows; r++) {
    const ref = XLSX.utils.encode_cell({ r, c }), cell = ws[ref];
    const m = cell && typeof cell.v === 'string' && cell.v.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/);
    if (!m) continue;
    const time = m[4] != null;
    ws[ref] = { t: 'n', v: Date.UTC(+m[1], +m[2] - 1, +m[3], time ? +m[4] : 0, time ? +m[5] : 0) / 86400000 + 25569, z: time ? 'yyyy-mm-dd hh:mm' : 'yyyy-mm-dd' };
  }
}

// The exporting computer's time zone, e.g. "Europe/Madrid (UTC+02:00)", for the Read me sheet.
export function timeZoneLabel(at = new Date()) {
  let name = '';
  try { name = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* old browser */ }
  const off = -at.getTimezoneOffset(), sign = off >= 0 ? '+' : '-', a = Math.abs(off);
  const utc = `UTC${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
  return name ? `${name} (${utc})` : utc;
}

// Report builder: keep only the chosen Measurements columns (cells already formatted), in master-sheet order.
function keepColumns(XLSX, ws, idx, nRows) {
  const cells = [];
  for (let r = 0; r <= nRows; r++) idx.forEach((c, i) => { const cell = ws[XLSX.utils.encode_cell({ r, c })]; if (cell) cells.push([r, i, cell]); });
  Object.keys(ws).filter((k) => k[0] !== '!').forEach((k) => delete ws[k]);
  cells.forEach(([r, c, cell]) => { ws[XLSX.utils.encode_cell({ r, c })] = cell; });
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: nRows, c: Math.max(0, idx.length - 1) } });
}

// Builds the 3-sheet export workbook (Results page and tests/export).
// nodules = the Accepted nodules of the selected (approved) scans.
export function buildWorkbook(XLSX, { scans, nodules, rejected = [], events: allEvents, initials, date, columns }) {
  const events = liveEvents(scans, allEvents); // a scan reset for re-import starts its trail again
  const meas = measurementRows(scans, nodules);
  const ws = XLSX.utils.aoa_to_sheet([MEAS_HEADERS, ...meas]);
  datesToExcel(XLSX, ws, meas.length);
  meas.forEach((_, r) => ONE_DEC_COLS.forEach((c) => { const cell = ws[XLSX.utils.encode_cell({ r: r + 1, c })]; if (cell && cell.t === 'n') cell.z = '0.0'; }));
  if (columns && columns.length < MEAS_HEADERS.length) keepColumns(XLSX, ws, columns.map((h) => MEAS_HEADERS.indexOf(h)), meas.length);
  const versions = [...new Set(scans.map((s) => s.engine_version).filter(Boolean))].join(', ') || 'unknown';
  const sMap = Object.fromEntries(scans.map((s) => [s.id, s]));
  const updated = nodules.filter((n) => n.changed_after_export && sMap[n.scan]).map((n) => { const s = sMap[n.scan]; return [`${s.patient_id} · ${String(s.scan_date).slice(0, 10)} · ${s.timepoint} · ${n.nodule_label || `${n.prior_label} (Not found)`}`]; });
  const readme = XLSX.utils.aoa_to_sheet([
    [`Exported from LungMarker on ${date} by ${initials}. For research use only. Not for clinical use. AI drafts by engine version ${versions}; every row was reviewed and approved by the person in 'Measured by'.`],
    [`${meas.length} row(s): ${meas.length - updated.length} new, ${updated.length} updated.`],
    [`Times in the Edit trail ("Changed at") are local time, ${timeZoneLabel()}: the time shown in the app on the computer that exported this file.`],
    ['"Minutes on scan" = active work on the scan, without long breaks. The time the scan was open (opening to approval) is in the Edit trail row "scan_approved".'],
    ['"Not found" rows: Nodule ID = the nodule\'s ID on the prior scan; no measurements.'],
    ...(updated.length ? [[], ['UPDATED ROWS — already in the master sheet from an earlier export. Replace the old row, do not add a second one:'], ...updated] : []),
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Measurements');
  const trail = trailRows(scans, events, [...nodules, ...rejected]); // rejected findings: trail only
  const wsTrail = XLSX.utils.aoa_to_sheet([TRAIL_HEADERS, ...trail]);
  datesToExcel(XLSX, wsTrail, trail.length);
  datesToExcel(XLSX, wsTrail, trail.length, TRAIL_HEADERS.length - 1);
  XLSX.utils.book_append_sheet(wb, wsTrail, 'Edit trail');
  XLSX.utils.book_append_sheet(wb, readme, 'Read me');
  return wb;
}