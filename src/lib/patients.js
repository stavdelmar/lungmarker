import { minutesOnScan } from '@/lib/minutes';
// Patient-by-patient work: Daniel reviews all of one patient's scans in one sitting, Baseline first.
// Pure functions (no Base44 calls) so the Worklist, the Review page and the tests share one rule.

// Baseline → 0, Follow-up 1 → 1, Follow-up 2 → 2 … (unknown labels last).
export const tpRank = (t = '') => (t === 'Baseline' ? 0 : parseInt(String(t).replace(/\D/g, ''), 10) || 99);
const day = (s) => String(s.scan_date || '').slice(0, 10);
export const isApproved = (s) => s.review_status === 'Approved';

// A patient's scans in review order: Baseline, Follow-up 1, 2 … (then by date).
export const scanOrder = (a, b) => tpRank(a.timepoint) - tpRank(b.timepoint) || day(a).localeCompare(day(b));

// The prior scan of a follow-up: the engine's link (prior_engine_scan_id) if that scan is in the app,
// else the same patient's scan one timepoint earlier. null for a Baseline.
export function priorOf(scan, scans) {
  if (!scan || tpRank(scan.timepoint) === 0) return null;
  if (scan.prior_engine_scan_id) {
    const linked = scans.find((s) => s.engine_scan_id === scan.prior_engine_scan_id);
    if (linked) return linked;
  }
  const earlier = scans.filter((s) => s.patient_id === scan.patient_id && s.id !== scan.id && scanOrder(s, scan) < 0).sort(scanOrder);
  return earlier[earlier.length - 1] || null;
}

// One row per patient. Patients with work left come first (started before not started), finished ones last.
export function groupPatients(scans) {
  const by = new Map();
  scans.forEach((s) => { if (!by.has(s.patient_id)) by.set(s.patient_id, []); by.get(s.patient_id).push(s); });
  const groups = [...by.entries()].map(([patient_id, list]) => {
    const ordered = [...list].sort(scanOrder);
    const approved = ordered.filter(isApproved).length;
    const next = ordered.find((s) => !isApproved(s)) || null;
    const started = ordered.some((s) => s.review_status && s.review_status !== 'Not started');
    const status = approved === ordered.length ? 'Done' : started ? 'In progress' : 'Not started';
    const minutes = ordered.reduce((m, s) => m + (minutesOnScan(s) || 0), 0); // active minutes (Minutes on scan)
    return { patient_id, scans: ordered, approved, total: ordered.length, next, status, minutes, followups: ordered.filter((s) => tpRank(s.timepoint) > 0).length };
  });
  const rank = { 'In progress': 0, 'Not started': 1, Done: 2 };
  return groups.sort((a, b) => rank[a.status] - rank[b.status] || a.patient_id.localeCompare(b.patient_id, undefined, { numeric: true }));
}

// After approving `scan`: the next scan of the same patient still to review (in order), else null.
export function nextScanForPatient(scan, scans) {
  return scans.filter((s) => s.patient_id === scan.patient_id && s.id !== scan.id && !isApproved(s)).sort(scanOrder)[0] || null;
}

// The next patient with work left (in Worklist order), other than `patientId`, and the scan to open there.
export function nextPatient(scans, patientId) {
  const g = groupPatients(scans).find((p) => p.patient_id !== patientId && p.next);
  return g ? { patient_id: g.patient_id, scan: g.next } : null;
}

// Engine scans whose prior link is missing get the same patient's previous timepoint (fills prior_engine_scan_id).
export function missingPriorLinks(scans) {
  return scans.filter((s) => tpRank(s.timepoint) > 0 && !s.prior_engine_scan_id).map((s) => {
    const p = priorOf(s, scans);
    return p ? { id: s.id, prior_engine_scan_id: p.engine_scan_id } : null;
  }).filter(Boolean);
}
