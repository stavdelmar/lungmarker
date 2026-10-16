// Patient-by-patient Worklist rules. Run: node --import ./tests/export/register.mjs tests/review/patients.test.mjs
import { groupPatients, priorOf, nextScanForPatient, nextPatient, missingPriorLinks } from '@/lib/patients';
let fails = 0;
const check = (name, ok, ev) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(64)} │ ${ev}`); if (!ok) fails++; };
const sc = (id, patient, tp, date, status = 'Not started', prior = '') => ({ id, engine_scan_id: `E-${id}`, patient_id: patient, timepoint: tp, scan_date: date, review_status: status, prior_engine_scan_id: prior });
// Two-thirds follow-ups, out of order, one prior link missing (engine didn't give it).
const scans = [
  sc('a2', 'P-A', 'Follow-up 2', '2025-09-01'), sc('a0', 'P-A', 'Baseline', '2025-01-10', 'Approved'), sc('a1', 'P-A', 'Follow-up 1', '2025-05-02', 'Approved', 'E-a0'),
  sc('b1', 'P-B', 'Follow-up 1', '2025-06-01', 'Not started', 'E-b0'), sc('b0', 'P-B', 'Baseline', '2025-02-01'),
  sc('c0', 'P-C', 'Baseline', '2025-03-01', 'Approved'), sc('c1', 'P-C', 'Follow-up 1', '2025-07-01', 'Approved', 'E-c0'),
  sc('d0', 'P-D', 'Baseline', '2025-04-01', 'In review'), sc('d1', 'P-D', 'Follow-up 1', '2025-08-01'),
];
const g = groupPatients(scans);
check('One row per patient', g.length === 4, g.map((p) => p.patient_id).join(', '));
check('Order: in progress first, then not started, finished last', g.map((p) => p.status).join(' → ') === 'In progress → In progress → Not started → Done', g.map((p) => `${p.patient_id} ${p.status}`).join(' · '));
const A = g.find((p) => p.patient_id === 'P-A');
check('Scans inside a patient: Baseline, Follow-up 1, Follow-up 2', A.scans.map((s) => s.timepoint).join(', ') === 'Baseline, Follow-up 1, Follow-up 2', A.scans.map((s) => s.timepoint).join(', '));
check('Opening a patient starts at the first scan not approved', A.next.id === 'a2' && g.find((p) => p.patient_id === 'P-B').next.id === 'b0', `P-A → ${A.next.timepoint}; P-B → ${g.find((p) => p.patient_id === 'P-B').next.timepoint}`);
check('Progress per patient', A.approved === 2 && A.total === 3, `P-A ${A.approved}/${A.total} approved`);
check('Finished patient has no next scan', g.find((p) => p.patient_id === 'P-C').next === null, 'P-C: none');
check('Prior of a follow-up: engine link', priorOf(scans.find((s) => s.id === 'a1'), scans).id === 'a0', 'P-A FU1 → Baseline');
check('Prior when the engine link is missing: previous timepoint', priorOf(scans.find((s) => s.id === 'a2'), scans).id === 'a1', 'P-A FU2 → FU1');
check('Baseline has no prior', priorOf(scans.find((s) => s.id === 'b0'), scans) === null, 'null');
const links = missingPriorLinks(scans);
check('Missing prior links are filled on sync', links.length === 2 && links.find((l) => l.id === 'a2').prior_engine_scan_id === 'E-a1' && links.find((l) => l.id === 'd1').prior_engine_scan_id === 'E-d0', JSON.stringify(links));
const approvedB0 = scans.map((s) => (s.id === 'b0' ? { ...s, review_status: 'Approved' } : s));
check('After approving: next scan for this patient', nextScanForPatient(approvedB0.find((s) => s.id === 'b0'), approvedB0).id === 'b1', 'P-B Baseline → Follow-up 1');
const approvedAll = approvedB0.map((s) => (s.id === 'b1' ? { ...s, review_status: 'Approved' } : s));
check('Last scan of a patient: no next scan', nextScanForPatient(approvedAll.find((s) => s.id === 'b1'), approvedAll) === null, 'null');
const np = nextPatient(approvedAll, 'P-B');
check('…then the next patient with work left', np && np.patient_id === 'P-A' && np.scan.id === 'a2', np ? `${np.patient_id} → ${np.scan.timepoint}` : 'none');
console.log(fails ? `\n${fails} failed` : '\nall pass');
process.exit(fails ? 1 : 0);
