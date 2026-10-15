import { MEAS_HEADERS, TRAIL_HEADERS, ONE_DEC_COLS, measurementRows, trailRows } from '@/lib/exportRows';

// Scan date column (B) as a real Excel date shown yyyy-mm-dd, so it sorts and filters as a date.
function datesToExcel(XLSX, ws, nRows) {
  for (let r = 1; r <= nRows; r++) {
    const ref = XLSX.utils.encode_cell({ r, c: 1 }), cell = ws[ref];
    const m = cell && typeof cell.v === 'string' && cell.v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) ws[ref] = { t: 'n', v: Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 + 25569, z: 'yyyy-mm-dd' };
  }
}

// Builds the 3-sheet export workbook. Used by the Export page and by tests/export.
// nodules = the Accepted nodules of the selected (approved) scans.
export function buildWorkbook(XLSX, { scans, nodules, events, initials, date }) {
  const meas = measurementRows(scans, nodules, events);
  const ws = XLSX.utils.aoa_to_sheet([MEAS_HEADERS, ...meas]);
  datesToExcel(XLSX, ws, meas.length);
  meas.forEach((_, r) => ONE_DEC_COLS.forEach((c) => { const cell = ws[XLSX.utils.encode_cell({ r: r + 1, c })]; if (cell && cell.t === 'n') cell.z = '0.0'; }));
  const versions = [...new Set(scans.map((s) => s.engine_version).filter(Boolean))].join(', ') || 'unknown';
  const sMap = Object.fromEntries(scans.map((s) => [s.id, s]));
  const updated = nodules.filter((n) => n.changed_after_export && sMap[n.scan]).map((n) => { const s = sMap[n.scan]; return [`${s.patient_id} · ${String(s.scan_date).slice(0, 10)} · ${s.timepoint} · ${n.nodule_label}`]; });
  const readme = XLSX.utils.aoa_to_sheet([
    [`Exported from LungMarker on ${date} by ${initials}. For research use only. Not for clinical use. AI drafts by engine version ${versions}; every row was reviewed and approved by the person in 'Measured by'.`],
    [`${meas.length} row(s): ${meas.length - updated.length} new, ${updated.length} updated.`],
    ...(updated.length ? [[], ['UPDATED ROWS — already in the master sheet from an earlier export. Replace the old row, do not add a second one:'], ...updated] : []),
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Measurements');
  const trail = trailRows(scans, events, nodules);
  const wsTrail = XLSX.utils.aoa_to_sheet([TRAIL_HEADERS, ...trail]);
  datesToExcel(XLSX, wsTrail, trail.length);
  XLSX.utils.book_append_sheet(wb, wsTrail, 'Edit trail');
  XLSX.utils.book_append_sheet(wb, readme, 'Read me');
  return wb;
}
