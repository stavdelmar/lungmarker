// Per-patient view for Results (Naomi): each nodule followed from the Baseline through the follow-ups via
// Daniel's "Match to prior", with the change in long axis and volume from its first to its last timepoint.
// Pure (no Base44 calls): the Results page and the tests share it.
import { scanOrder } from '@/lib/patients';

const day = (s) => String(s?.scan_date || '').slice(0, 10);
const change = (a, b) => (a == null || b == null ? null : { abs: b - a, pct: a ? ((b - a) / a) * 100 : null });

// volume shown only for a confirmed outline (Daniel's rule); otherwise the reason
export const volumeOf = (n) => (n && n.outline_confirmed && n.volume_mm3 != null ? n.volume_mm3 : null);

export function patientTracks(scans, nodules) {
  const byPatient = new Map();
  scans.forEach((s) => { if (!byPatient.has(s.patient_id)) byPatient.set(s.patient_id, []); byPatient.get(s.patient_id).push(s); });
  return [...byPatient.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([patient_id, list]) => {
    const tps = [...list].sort(scanOrder);
    const rows = nodules.filter((n) => tps.some((s) => s.id === n.scan) && n.status === 'Accepted');
    const at = (s) => rows.filter((n) => n.scan === s.id);
    const used = new Set();
    const tracks = [];
    tps.forEach((s, i) => {
      at(s).filter((n) => n.kind !== 'prior_not_found' && !used.has(n.id)).forEach((start) => {
        const cells = tps.map(() => null);
        cells[i] = start; used.add(start.id);
        let cur = start, notFoundAt = null;
        for (let j = i + 1; j < tps.length; j++) {
          const nx = at(tps[j]).find((n) => n.kind !== 'prior_not_found' && !used.has(n.id) && n.match_to_prior === cur.nodule_label);
          if (nx) { cells[j] = nx; used.add(nx.id); cur = nx; continue; }
          const gone = at(tps[j]).find((n) => n.kind === 'prior_not_found' && n.prior_label === cur.nodule_label);
          if (gone) { used.add(gone.id); notFoundAt = j; }
          break;
        }
        const seen = cells.map((c, k) => (c ? k : -1)).filter((k) => k >= 0);
        const first = cells[seen[0]], last = cells[seen[seen.length - 1]];
        const multi = seen.length > 1;
        tracks.push({
          key: start.id, lobe: last.lobe || first.lobe, labels: seen.map((k) => cells[k].nodule_label), cells, notFoundAt,
          newAt: i > 0 && (start.match_to_prior === 'N/A' || !start.match_to_prior) ? i : null,
          long: multi ? change(first.long_axis_mm, last.long_axis_mm) : null,
          volume: multi ? change(volumeOf(first), volumeOf(last)) : null,
          volumeMissing: multi && (volumeOf(first) == null || volumeOf(last) == null),
        });
      });
    });
    const sameDay = tps.length > 1 && tps.every((s) => day(s) === day(tps[0]));
    return { patient_id, timepoints: tps, tracks, sameDay };
  });
}

// Results card: what Daniel did with the AI's findings, and how many volumes made it into the sheet.
export function reviewBreakdown(nodules) {
  const ai = nodules.filter((n) => n.source === 'AI' && n.kind !== 'prior_not_found');
  const measured = nodules.filter((n) => n.status === 'Accepted' && n.kind !== 'prior_not_found');
  return {
    unchanged: ai.filter((n) => n.status === 'Accepted' && !n.was_edited).length,
    edited: ai.filter((n) => n.status === 'Accepted' && n.was_edited).length,
    rejected: ai.filter((n) => n.status === 'Rejected').length,
    added: nodules.filter((n) => n.source !== 'AI' && n.kind !== 'prior_not_found' && n.status === 'Accepted').length,
    measured: measured.length,
    volumes: measured.filter((n) => volumeOf(n) != null).length,
  };
}
