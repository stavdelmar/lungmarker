// When the AI is unsure about a finding. One rule, used by the nodule list, the form and the image.
// - unsure about the edges: engine flag `low_confidence`. The engine's confidence = how much of the drawn outline
//   the model itself marked (the rest was added by the rim step), so low means "check the outline", not
//   "this may not be a nodule". The engine sets the flag below 0.6; the same 0.6 is used if a finding has a
//   confidence but no flags list (older data).
// - possible vessel: engine flag `possible_vessel` (thin and tall; rarely fires, a safety net)
export const LOW_CONFIDENCE = 0.6;

export function uncertainty(n) {
  if (!n || n.kind === 'prior_not_found' || n.source !== 'AI') return { unsure: false, lowConf: false, vessel: false, pct: null };
  const flags = n.flags || [];
  const conf = n.ai_confidence ?? n.ai_draft?.confidence ?? null;
  const faintRim = flags.includes('faint_rim');
  const lowConf = faintRim || flags.includes('low_confidence') || (!Array.isArray(n.flags) && conf != null && conf < LOW_CONFIDENCE);
  const vessel = flags.includes('possible_vessel');
  return { unsure: lowConf || vessel, lowConf, faintRim, vessel, pct: faintRim || conf == null ? null : Math.round(conf * 100) };
}

// Other engine flags, in words (shown small; they are information, not doubt).
export const FLAG_TEXT = { touches_pleura: 'touches the pleura', below_4mm: 'under 4 mm' };

export const notFoundNote = (n) => `Prior ${n.prior_label}${n.lobe ? ` (${n.lobe})` : ''} not seen on this scan.`;