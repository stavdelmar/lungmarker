import { base44 } from '@/api/base44Client';
import { largestPoly, meanOf, normType, r1 } from '@/lib/geometry';

// Creates one Nodule per AI finding the first time a scan is opened. Never re-run afterwards.
export async function initNodules(scan, findings, priorNodules) {
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
