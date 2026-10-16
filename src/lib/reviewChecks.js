// What still blocks "Approve scan", in plain words. Pure (no Base44 calls): the panel and the tests share it.
export const CENTRAL = 'central'; // id of the "Central areas" item at the end of the nodule list

const num = (label = '') => parseInt(String(label).replace(/\D/g, ''), 10) || 0;

// List order: nodules by Nodule ID (N1, N2, N3 …), then the prior nodules "not found here?" by prior ID.
export function sortNodules(list) {
  const found = list.filter((n) => n.kind !== 'prior_not_found').sort((a, b) => num(a.nodule_label) - num(b.nodule_label));
  const gone = list.filter((n) => n.kind === 'prior_not_found').sort((a, b) => num(a.prior_label) - num(b.prior_label));
  return [...found, ...gone];
}

export const isDecided = (n) => n.status === 'Accepted' || n.status === 'Rejected';

// An accepted nodule goes into Daniel's sheet, so it needs a lobe and a type ("Not found" rows carry the prior's lobe only).
export function missingFields(n) {
  if (n.status !== 'Accepted' || n.kind === 'prior_not_found') return [];
  return [!n.lobe && 'lobe', !n.type && 'type'].filter(Boolean);
}

export function approveBlockers(nodules, centralDone) {
  const decided = nodules.filter(isDecided).length;
  const missing = nodules.map((n) => ({ n, fields: missingFields(n) })).filter((m) => m.fields.length);
  const firstOpen = nodules.find((n) => !isDecided(n)) || missing[0]?.n || null;
  const nodulesOk = decided === nodules.length && !missing.length;
  // Every reason at once, so Daniel sees all that is left (e.g. "1 not decided yet · N3: no lobe").
  const why = [decided < nodules.length && `${nodules.length - decided} not decided yet`,
    ...missing.map((m) => `${m.n.nodule_label}: no ${m.fields.join(' or ')}`)].filter(Boolean).join(' · ');
  return { decided, total: nodules.length, missing, firstOpen, nodulesOk, centralDone: !!centralDone, ok: nodulesOk && !!centralDone, why };
}

// "Next" (N): the next item still open after the current one (nodules in list order, then Central areas);
// if everything is done, simply the next item in the list.
export function nextItem(nodules, currentId, centralDone) {
  const items = [...nodules.map((n) => ({ id: n.id, open: !isDecided(n) || missingFields(n).length > 0 })), { id: CENTRAL, open: !centralDone }];
  const i = items.findIndex((x) => x.id === currentId);
  const order = [...items.slice(i + 1), ...items.slice(0, i + 1)];
  return (order.find((x) => x.open && x.id !== currentId) || order[0]).id;
}

// Numbers typed by hand: accept "5,3" (comma locales) and "5.3"; null for empty; NaN-safe.
export function parseNum(text) {
  const s = String(text ?? '').trim().replace(',', '.');
  if (s === '') return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : undefined; // undefined = not a number → keep the old value
}

// Soft reminder before Approve (Daniel's rule: a volume is recorded only for a confirmed outline). Never blocks.
// Accepted measured nodules whose outline is not confirmed, so their Volume cell will stay empty.
export function unconfirmedOutlines(nodules) {
  return nodules.filter((n) => n.status === 'Accepted' && n.kind !== 'prior_not_found' && !n.outline_confirmed);
}
