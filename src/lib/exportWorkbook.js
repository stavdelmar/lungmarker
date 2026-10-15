import { MEAS_HEADERS, TRAIL_HEADERS, ONE_DEC_COLS, measurementRows, trailRows } from '@/lib/exportRows';

// Builds the 3-sheet export workbook. Used by the Export page and by tests/export.
// nodules = the Accepted nodules of the selected (approved) scans.
export function buildWorkbook(XLSX, { scans, nodules, events, initials, date }) {
  const meas = measurementRows(scans, nodules, events);
  const ws = XLSX.utils.aoa_to_sheet([MEAS_HEADERS, ...meas]);
  meas.forEach((_, r) => ONE_DEC_COLS.forEach((c) => { const cell = ws[XLSX.utils.encode_cell({ r: r + 1, c })]; if (cell && cell.t === 'n') cell.z = '0.0'; }));
  const versions = [...new Set(scans.map((s) => s.engine_version).filter(Boolean))].join(', ') || 'unknown';
  const readme = XLSX.utils.aoa_to_sheet([[`Exported from LungMarker on ${date} by ${initials}. For research use only. Not for clinical use. AI drafts by engine version ${versions}; every row was reviewed and approved by the person in 'Measured by'.`]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Measurements');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([TRAIL_HEADERS, ...trailRows(scans, events, nodules)]), 'Edit trail');
  XLSX.utils.book_append_sheet(wb, readme, 'Read me');
  return wb;
}
