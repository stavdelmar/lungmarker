// Outline editing in the browser, no engine needed.
// An outline (polygon in image pixels) is turned into a small pixel mask, edited with a round brush
// (erase / paint back), and traced back into a polygon. After an erase, only the biggest connected
// piece is kept, so cutting across a vessel tail removes the tail and keeps the nodule.

const SUB = 2; // mask cells per image pixel (smoother edges)

export function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function makeMask(poly, extraPts, pad) {
  const pts = [...(poly || []), ...(extraPts || [])];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs) - pad), y0 = Math.floor(Math.min(...ys) - pad);
  const w = Math.ceil((Math.max(...xs) + pad - x0) * SUB) + 2, h = Math.ceil((Math.max(...ys) + pad - y0) * SUB) + 2;
  const data = new Uint8Array(w * h);
  if (poly && poly.length > 2) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (pointInPoly(x0 + (i + 0.5) / SUB, y0 + (j + 0.5) / SUB, poly)) data[j * w + i] = 1;
    }
  }
  return { x0, y0, w, h, data };
}

// Stamp a round brush (radius r image px) along a stroke; value 0 = erase, 1 = paint.
function stamp(m, stroke, r, value) {
  const pts = [];
  for (let k = 0; k < stroke.length; k++) {
    const a = stroke[k], b = stroke[k + 1] || a;
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (r / 2)));
    for (let t = 0; t < n; t++) pts.push([a[0] + ((b[0] - a[0]) * t) / n, a[1] + ((b[1] - a[1]) * t) / n]);
  }
  const rr = r * r;
  for (const [px, py] of pts) {
    const i0 = Math.max(0, Math.floor((px - r - m.x0) * SUB)), i1 = Math.min(m.w - 1, Math.ceil((px + r - m.x0) * SUB));
    const j0 = Math.max(0, Math.floor((py - r - m.y0) * SUB)), j1 = Math.min(m.h - 1, Math.ceil((py + r - m.y0) * SUB));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const dx = m.x0 + (i + 0.5) / SUB - px, dy = m.y0 + (j + 0.5) / SUB - py;
      if (dx * dx + dy * dy <= rr) m.data[j * m.w + i] = value;
    }
  }
}

// Keep only the biggest 4-connected piece.
function keepLargest(m) {
  const lab = new Int32Array(m.w * m.h);
  let best = 0, bestSize = 0, cur = 0;
  for (let s = 0; s < m.data.length; s++) {
    if (!m.data[s] || lab[s]) continue;
    cur++; let size = 0; const stack = [s]; lab[s] = cur;
    while (stack.length) {
      const q = stack.pop(); size++;
      const i = q % m.w, j = (q - i) / m.w;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= m.w || nj >= m.h) continue;
        const nq = nj * m.w + ni;
        if (m.data[nq] && !lab[nq]) { lab[nq] = cur; stack.push(nq); }
      }
    }
    if (size > bestSize) { bestSize = size; best = cur; }
  }
  for (let s = 0; s < m.data.length; s++) m.data[s] = best && lab[s] === best ? 1 : 0;
  return bestSize;
}

// Outer boundary of the mask, in image pixels: collect every cell side that borders an empty cell
// (oriented so the filled cell is on the right), chain the sides into closed loops, keep the largest loop.
function trace(m) {
  const at = (i, j) => (i >= 0 && j >= 0 && i < m.w && j < m.h ? m.data[j * m.w + i] : 0);
  const out = new Map(); // "x,y" -> list of next corners
  const add = (ax, ay, bx, by) => { const k = `${ax},${ay}`; (out.get(k) || out.set(k, []).get(k)).push([bx, by]); };
  for (let j = 0; j < m.h; j++) for (let i = 0; i < m.w; i++) {
    if (!m.data[j * m.w + i]) continue;
    if (!at(i, j - 1)) add(i, j, i + 1, j);
    if (!at(i + 1, j)) add(i + 1, j, i + 1, j + 1);
    if (!at(i, j + 1)) add(i + 1, j + 1, i, j + 1);
    if (!at(i - 1, j)) add(i, j + 1, i, j);
  }
  let best = [], bestA = 0;
  for (const [k0] of out) {
    if (!out.get(k0)?.length) continue;
    const loop = [];
    let [x, y] = k0.split(',').map(Number), prev = null;
    for (let guard = 0; guard < 4 * m.w * m.h + 8; guard++) {
      const nexts = out.get(`${x},${y}`);
      if (!nexts?.length) break;
      let pick = 0;
      if (nexts.length > 1 && prev) { // diagonal pinch: turn right (keeps 4-connected pieces separate)
        const [dx, dy] = [x - prev[0], y - prev[1]];
        pick = Math.max(0, nexts.findIndex(([nx, ny]) => (nx - x) === -dy && (ny - y) === dx));
      }
      const [nx, ny] = nexts.splice(pick, 1)[0];
      loop.push([m.x0 + x / SUB, m.y0 + y / SUB]);
      prev = [x, y]; x = nx; y = ny;
      if (`${x},${y}` === k0) break;
    }
    let a = 0;
    for (let q = 0; q < loop.length; q++) { const [x1, y1] = loop[q], [x2, y2] = loop[(q + 1) % loop.length]; a += x1 * y2 - x2 * y1; }
    if (Math.abs(a) > bestA) { bestA = Math.abs(a); best = loop; }
  }
  return best;
}

// Douglas–Peucker simplification of a closed loop (split at the point farthest from the first one).
function dpOpen(pts, eps) {
  if (pts.length < 3) return pts;
  const [x1, y1] = pts[0], [x2, y2] = pts[pts.length - 1], L = Math.hypot(x2 - x1, y2 - y1) || 1e-9;
  let idx = -1, max = 0;
  for (let k = 1; k < pts.length - 1; k++) {
    const d = Math.abs((y2 - y1) * pts[k][0] - (x2 - x1) * pts[k][1] + x2 * y1 - y2 * x1) / L;
    if (d > max) { max = d; idx = k; }
  }
  if (max <= eps) return [pts[0], pts[pts.length - 1]];
  return [...dpOpen(pts.slice(0, idx + 1), eps).slice(0, -1), ...dpOpen(pts.slice(idx), eps)];
}
function simplify(loop, eps) {
  if (loop.length < 4) return loop;
  let far = 0, fd = -1;
  loop.forEach((p, k) => { const d = Math.hypot(p[0] - loop[0][0], p[1] - loop[0][1]); if (d > fd) { fd = d; far = k; } });
  const a = dpOpen(loop.slice(0, far + 1), eps), b = dpOpen([...loop.slice(far), loop[0]], eps);
  return [...a.slice(0, -1), ...b.slice(0, -1)].map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
}

function maskToPoly(m, maxPts = 80) {
  let eps = 0.35, poly = simplify(trace(m), eps);
  while (poly.length > maxPts && eps < 4) { eps *= 1.5; poly = simplify(trace(m), eps); }
  return poly.length >= 3 ? poly : [];
}

// Erase (or paint back with mode 'paint') along a stroke. Returns the new polygon ([] if nothing is left).
export function brushEdit(poly, stroke, radiusPx, mode = 'erase') {
  if (!stroke?.length) return poly || [];
  if (mode === 'erase' && (!poly || poly.length < 3)) return [];
  const m = makeMask(poly, mode === 'paint' ? stroke : null, radiusPx + 2);
  stamp(m, stroke, radiusPx, mode === 'paint' ? 1 : 0);
  return keepLargest(m) ? maskToPoly(m) : [];
}

// A hand-drawn closed outline (lasso) cleaned into a simple polygon. Null if it is too small to be an outline.
export function lassoToPoly(stroke) {
  if (!stroke || stroke.length < 6) return null;
  const xs = stroke.map((p) => p[0]), ys = stroke.map((p) => p[1]);
  if (Math.max(...xs) - Math.min(...xs) < 3 && Math.max(...ys) - Math.min(...ys) < 3) return null;
  const m = makeMask(stroke, null, 2);
  return keepLargest(m) ? maskToPoly(m) : null;
}
