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
        long_axis_px: f.long_axis_px, short_axis_px: f.short_axis_px, match: f.match || null, match_label: matchLabel,
      },
    };
  });
  if (recs.length) await base44.entities.Nodule.bulkCreate(recs);
}