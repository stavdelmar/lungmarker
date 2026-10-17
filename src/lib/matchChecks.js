// Soft warnings when a "Match to prior" looks implausible. Never blocks: Daniel decides.
// Uses only what the app has: the two nodules' lobe and long axis, and the engine's registration result for the pair
// it suggested (ai_draft.match: prior finding + distance after registration). The engine does not export its
// registration transform, so a pair the engine never proposed has no registered distance to check.
export const LONG_AXIS_CHANGE = 0.5; // > 50% difference vs the prior
export const gateMm = (longMm) => Math.max(10, 0.75 * (Number(longMm) || 0)); // the engine's own matching gate

const f1 = (v) => Number(v).toFixed(1);

// sel = current nodule, label = the prior label it is (or would be) matched to, priorNodules = prior scan's nodules,
// nodules = this scan's nodules (to spot the same prior matched twice). Returns [{ kind, text }].
export function matchWarnings(sel, label, priorNodules = [], nodules = []) {
  if (!sel || !label || label === 'N/A' || label === 'Not found') return [];
  const p = priorNodules.find((x) => x.nodule_label === label);
  const out = [];
  if (p) {
    if (sel.lobe && p.lobe && sel.lobe !== p.lobe) out.push({ kind: 'lobe', text: `Different lobe: ${sel.lobe} here, ${p.lobe} on the prior.` });
    const a = Number(sel.long_axis_mm), b = Number(p.long_axis_mm);
    if (a > 0 && b > 0 && Math.round((Math.abs(a - b) / b) * 1000) / 1000 > LONG_AXIS_CHANGE) { // rounded: 7.1 / 14.2 is exactly 50%
      const pct = Math.round(((a - b) / b) * 100);
      out.push({ kind: 'size', text: `Long axis ${f1(a)} mm vs ${f1(b)} mm on the prior (${pct > 0 ? '+' : ''}${pct}%).` });
    }
  }
  const ai = sel.ai_draft || {};
  const aiLabel = ai.match_label || '';
  if (aiLabel && aiLabel !== label) {
    out.push({ kind: 'position', text: `The AI's registration places prior ${aiLabel} here, not ${label}${ai.match?.distance_mm != null ? ` (${aiLabel} is ${f1(ai.match.distance_mm)} mm away after registration)` : ''}.` });
  } else if (aiLabel === label && ai.match?.distance_mm != null && ai.match.distance_mm > gateMm(sel.long_axis_mm)) {
    out.push({ kind: 'position', text: `Far from the registered position: ${f1(ai.match.distance_mm)} mm (limit ${f1(gateMm(sel.long_axis_mm))} mm).` });
  }
  const twice = nodules.filter((n) => n.id !== sel.id && n.kind !== 'prior_not_found' && n.status !== 'Rejected' && n.match_to_prior === label).map((n) => n.nodule_label);
  if (twice.length) out.push({ kind: 'twice', text: `Prior ${label} is also matched to ${twice.join(', ')}.` });
  return out;
}

// Current nodules whose recorded match has at least one warning (for the before-approving line).
export function matchesToCheck(nodules, priorNodules) {
  return nodules.filter((n) => n.kind !== 'prior_not_found' && n.status !== 'Rejected' && matchWarnings(n, n.match_to_prior, priorNodules, nodules).length);
}
