import { base44 } from '@/api/base44Client';
import { largestPoly, meanOf, normType, r1 } from '@/lib/geometry';

// One Nodule record per AI finding (labels N1, N2 … by slice order, over ALL findings so a partial re-run keeps them).
export function noduleRecords(scan, findings, priorNodules) {
  const sorted = [...findings].sort((a, b) => a.key_slice_z - b.key_slice_z);
  const recs = sorted.map((f, i) => {
    const contour = largestPoly(f.contours?.[String(f.key_slice_z)]);
    const long = r1(f.long_axis_mm), short = r1(f.short_axis_mm);
    const vol = f.volume_mm3 == null ? null : Math.round(f.volume_mm3);
    const type = normType(f.type_guess);
    const solid = type === 'Part-solid' && f.solid_component_mm != null ? r1(f.solid_component_mm) : null;
    const matchLabel = f.match ? priorNodules.find((n) => n.engine_finding_id === f.match.prior_finding_id)?.nodule_label || '' : '';
    return {
      scan: scan.id, engine_scan_id: scan.engine_scan_id, nodule_label: `N${i + 1}`, source: 'AI', engine_finding_id: f.finding_id,
      status: 'Pending', was_edited: false, lobe: f.lobe, slice_number: f.key_slice_number, key_slice_z: f.key_slice_z, type,
      long_axis_mm: long, short_axis_mm: short, mean_diameter_mm: meanOf(long, short), solid_component_mm: solid, volume_mm3: vol, outline_confirmed: false,
      match_to_prior: '', key_contour_px: contour, long_axis_px: f.long_axis_px, short_axis_px: f.short_axis_px,
      flags: f.flags || [], ai_confidence: f.confidence,
      ai_draft: {
        lobe: f.lobe, type, long, short, solid, volume: vol, key_slice_number: f.key_slice_number, key_slice_z: f.key_slice_z, contour,
        long_axis_px: f.long_axis_px, short_axis_px: f.short_axis_px, match: f.match || null, match_label: matchLabel, confidence: f.confidence ?? null, flags: f.flags || [],
      },
    };
  });
  return recs;
}
// Creates one Nodule per AI finding. Low-level (tests); the app uses setupScan, which guards against running twice.
export async function initNodules(scan, findings, priorNodules) {
  const recs = noduleRecords(scan, findings, priorNodules);
  if (recs.length) await base44.entities.Nodule.bulkCreate(recs);
}
// Follow-ups: every prior nodule that is not found in this scan becomes a "Not found in this scan?" item for
// Daniel to confirm. Source 1 = the engine's match_summary.not_found_in_current (prior finding IDs).
// Source 2 = prior nodules Daniel added by hand (the engine never saw them, so it can't match them).
// Rejected prior nodules are skipped. Items are Pending until Daniel decides.
export function notFoundItems(scan, matchSummary, priorNodules) {
  const gone = new Set(matchSummary?.not_found_in_current || []);
  const prior = priorNodules.filter((p) => p.status !== 'Rejected' && (p.kind || 'nodule') === 'nodule');
  const items = prior.filter((p) => (p.engine_finding_id && gone.has(p.engine_finding_id)) || (!p.engine_finding_id && p.source !== 'AI'));
  return items.sort((a, b) => String(a.nodule_label).localeCompare(String(b.nodule_label), undefined, { numeric: true })).map((p) => ({
    scan: scan.id, engine_scan_id: scan.engine_scan_id, kind: 'prior_not_found', nodule_label: '', prior_label: p.nodule_label,
    source: p.source === 'AI' ? 'AI: not found in this scan' : 'Prior nodule added by hand (not matched by the AI)',
    engine_finding_id: '', status: 'Pending', was_edited: false, lobe: p.lobe || '', type: p.type || '', slice_number: null, key_slice_z: null,
    long_axis_mm: null, short_axis_mm: null, mean_diameter_mm: null, volume_mm3: null, outline_confirmed: false,
    match_to_prior: '', notes: '', key_contour_px: [], contour_edits: {}, flags: [],
    ai_draft: { not_found: true, prior_label: p.nodule_label, prior_lobe: p.lobe || '', prior_long: p.long_axis_mm ?? null, prior_short: p.short_axis_mm ?? null, from_engine: !!p.engine_finding_id },
  }));
}

// The same item, created live when a prior nodule ends up matched by nothing in this scan (Daniel matched
// differently than the AI suggested, or rejected the nodule that matched it).
export function notFoundItemFor(scan, p) {
  const [item] = notFoundItems(scan, { not_found_in_current: [p.engine_finding_id].filter(Boolean) }, [{ ...p, source: p.source || 'AI', engine_finding_id: p.engine_finding_id || '' }]);
  const base = item || notFoundItems(scan, {}, [{ ...p, engine_finding_id: '', source: 'Added by reviewer' }])[0];
  return { ...base, source: 'Not matched by any nodule in this scan', ai_draft: { ...base.ai_draft, from_engine: false, unmatched: true } };
}

export async function initNotFound(scan, matchSummary, priorNodules) {
  const recs = notFoundItems(scan, matchSummary, priorNodules);
  if (recs.length) await base44.entities.Nodule.bulkCreate(recs);
  return recs.length;
}

// ---- First opening of a scan: copy the AI draft in, exactly once -------------------------------------------------
// Bug 17 Oct (RIDER-1332496276 Follow-up 1 had N1, N1, N2, N2): the page decided "no nodules yet → create them" from
// its own copy of the data, so two setups running at the same time both created the full set — two tabs (e.g. the
// Base44 editor preview and the live app, both on the scan after a reset), or the page re-mounting while its first
// setup was still running. Now:
//  1. one setup per scan per tab (calls while one runs share it);
//  2. a claim on the Scan record (setup_token), re-read after a short wait: of two tabs, only the last writer goes on;
//  3. the nodules are re-read from Base44 right before creating, and only findings / not-found items that are not
//     there yet are created (by engine finding ID / prior label), so even a late second run adds nothing.
const setups = new Map();
export const CLAIM_MS = 400;
export function setupScan(scan, opts) {
  if (setups.has(scan.id)) return setups.get(scan.id);
  const run = doSetup(scan, opts).finally(() => setups.delete(scan.id));
  setups.set(scan.id, run);
  return run;
}
// Exported for tests only: the same setup without the per-tab sharing, i.e. what a second tab would run.
export async function setupScanUnshared(scan, opts) { return doSetup(scan, opts); }
async function doSetup(scan, { findings = [], matchSummary = null, priorNodules = [], scanPatch = {}, wait = CLAIM_MS } = {}) {
  const { Scan, Nodule } = base44.entities;
  const before = await Scan.get(scan.id);
  if (before?.review_status && before.review_status !== 'Not started') return { created: 0, skipped: 'already set up' };
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await Scan.update(scan.id, { setup_token: token });
  if (wait) await new Promise((r) => setTimeout(r, wait));
  const claimed = await Scan.get(scan.id);
  if (claimed.setup_token !== token) return { created: 0, skipped: 'set up by another tab' };
  if (claimed.review_status && claimed.review_status !== 'Not started') return { created: 0, skipped: 'already set up' };
  const existing = (await Nodule.filter({ scan: scan.id }, { limit: 500 })).items;
  const haveF = new Set(existing.filter((n) => (n.kind || 'nodule') === 'nodule' && n.engine_finding_id).map((n) => n.engine_finding_id));
  const haveP = new Set(existing.filter((n) => n.kind === 'prior_not_found').map((n) => n.prior_label));
  const recs = [
    ...noduleRecords(scan, findings, priorNodules).filter((r) => !haveF.has(r.engine_finding_id)),
    ...(scan.timepoint !== 'Baseline' ? notFoundItems(scan, matchSummary, priorNodules).filter((r) => !haveP.has(r.prior_label)) : []),
  ];
  if (recs.length) await Nodule.bulkCreate(recs);
  await Scan.update(scan.id, { review_status: 'In review', ...scanPatch });
  return { created: recs.length, skipped: '' };
}

// ---- Clean-up of duplicates left by the old setup -----------------------------------------------------------------
// Same AI finding (engine finding ID) or same prior "not found?" item (prior label) twice in one scan. Keeps the copy
// with the most review work on it (exported > decided > edited > outline confirmed), then the oldest.
const work = (n) => (n.exported_at ? 8 : 0) + (n.status === 'Accepted' || n.status === 'Rejected' ? 4 : 0) + (n.was_edited ? 2 : 0) + (n.outline_confirmed ? 1 : 0);
export function duplicateNodules(nodules) {
  const groups = new Map();
  for (const n of nodules) {
    const key = (n.kind || 'nodule') === 'nodule' ? (n.source === 'AI' && n.engine_finding_id ? `f:${n.scan}:${n.engine_finding_id}` : null)
      : n.kind === 'prior_not_found' && n.prior_label ? `p:${n.scan}:${n.prior_label}` : null;
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(n);
  }
  const keep = [], remove = [];
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const ordered = [...g].sort((a, b) => work(b) - work(a) || String(a.created_date || '').localeCompare(String(b.created_date || '')) || String(a.id).localeCompare(String(b.id)));
    keep.push(ordered[0]); remove.push(...ordered.slice(1));
  }
  return { keep, remove };
}
