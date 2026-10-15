// All calls to the external AI engine live here so it can be swapped later.
const trim = (b) => (b || '').replace(/\/+$/, '');

async function req(url, opts) {
  let res;
  try {
    res = await fetch(url, opts);
  } catch {
    throw new Error('Could not reach the engine.');
  }
  if (!res.ok) throw new Error(`Engine responded with ${res.status}.`);
  return res.json();
}

function need(base) {
  if (!base) throw new Error('Engine URL is not set (Settings).');
  return trim(base);
}

export const engine = {
  health: (base) => req(`${need(base)}/api/v1/health.json`),
  scans: (base) => req(`${need(base)}/api/v1/scans.json`),
  meta: (base, id) => req(`${need(base)}/api/v1/scans/${id}/meta.json`),
  findings: (base, id) => req(`${need(base)}/api/v1/scans/${id}/findings.json`),
  refine: (base, id, body) =>
    req(`${need(base)}/api/v1/scans/${id}/refine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  sliceUrl: (base, id, window, z) => `${trim(base)}/api/v1/scans/${id}/slices/${window}/${z}.png`,
};