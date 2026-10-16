// When the AI is unsure about a finding. One rule, used by the nodule list, the form and the image.
// - low confidence: engine flag `low_confidence` (max probability < 0.5) or a stored confidence < 0.5
// - possible vessel: engine flag `possible_vessel` (a vessel seen end-on can look like a nodule)
export const LOW_CONFIDENCE = 0.5;

export function uncertainty(n) {
  if (!n || n.kind === 'prior_not_found' || n.source !== 'AI') return { unsure: false, lowConf: false, vessel: false, pct: null };
  const flags = n.flags || [];
  const conf = n.ai_confidence ?? n.ai_draft?.confidence ?? null;
  const lowConf = flags.includes('low_confidence') || (conf != null && conf < LOW_CONFIDENCE);
  const vessel = flags.includes('possible_vessel');
  return { unsure: lowConf || vessel, lowConf, vessel, pct: conf == null ? null : Math.round(conf * 100) };
}

// Other engine flags, in words (shown small; they are information, not doubt).
export const FLAG_TEXT = { touches_pleura: 'touches the pleura', below_4mm: 'under 4 mm' };

export const notFoundNote = (n) => `Prior ${n.prior_label}${n.lobe ? ` (${n.lobe})` : ''} not seen on this scan.`;
