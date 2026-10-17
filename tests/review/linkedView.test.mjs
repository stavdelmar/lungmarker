// Side-by-side prior: both panes centred on their nodules at the same physical zoom, locked together.
import { initialLink, paneView, linkFromPane, priorSlice, centreOf } from '@/lib/linkedView';
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
// current scan 512² at 0.70 mm, prior 512² at 0.78 mm (different spacing on purpose); nodules in different places
const cur = { box: [300, 200, 340, 236], sp: [0.70, 0.70], cols: 512, rows: 512, fit: 1.2 };
const pri = { box: [120, 280, 156, 312], sp: [0.78, 0.78], cols: 512, rows: 512, fit: 1.2 };
const where = (pane, v, p) => [(p[0] - pane.cols / 2) * v.zoom * pane.fit + v.pan.x, (p[1] - pane.rows / 2) * v.zoom * pane.fit + v.pan.y]; // screen offset from pane centre

const link = initialLink({ boxes: [cur.box, pri.box], sps: [cur.sp, pri.sp], panes: [{ w: 600, h: 700 }, { w: 600, h: 700 }], fits: [cur.fit, pri.fit] });
const vc = paneView(link, cur), vp = paneView(link, pri);
ok(where(cur, vc, centreOf(cur.box)).every((v) => near(v, 0)), 'opens with the current nodule centred');
ok(where(pri, vp, centreOf(pri.box)).every((v) => near(v, 0)), 'opens with the prior nodule centred');
ok(near(vc.zoom * cur.fit / cur.sp[0], vp.zoom * pri.fit / pri.sp[0]), 'same physical zoom (screen px per mm) in both panes');
const spanPx = Math.max(40 * 0.70, 36 * 0.78) * link.k;
ok(near(spanPx, 0.25 * 600, 1e-6), `larger nodule spans a quarter of the pane (${spanPx.toFixed(1)} px)`);
ok(vc.zoom >= 1 && vc.zoom <= 12 && vp.zoom >= 1 && vp.zoom <= 12, 'zoom inside the viewer range');

// user pans the CURRENT pane by (+50, −30) screen px → the prior pane moves the same way
const panned = linkFromPane({ zoom: vc.zoom, pan: { x: vc.pan.x + 50, y: vc.pan.y - 30 } }, cur);
ok(near(panned.o[0], 50) && near(panned.o[1], -30) && near(panned.k, link.k), 'pan → shared offset');
ok(where(pri, paneView(panned, pri), centreOf(pri.box)).every((v, i) => near(v, [50, -30][i])), 'prior nodule moved by the same 50, −30 px');
// user zooms the PRIOR pane ×2 → current pane zooms ×2 too (round trip exact)
const vp2 = { zoom: vp.zoom * 2, pan: { x: vp.pan.x * 2, y: vp.pan.y * 2 } };
const zoomed = linkFromPane(vp2, pri);
ok(near(zoomed.k, link.k * 2), 'zoom in one pane doubles the shared scale');
ok(near(paneView(zoomed, cur).zoom, vc.zoom * 2), 'the other pane zooms by the same factor');
const back = paneView(linkFromPane(vc, cur), cur);
ok(near(back.zoom, vc.zoom) && near(back.pan.x, vc.pan.x) && near(back.pan.y, vc.pan.y), 'pane → link → pane round trip is exact');

// slices: same mm distance from each nodule's key slice (current 1.25 mm, prior 2.5 mm slices)
const curSlices = Array.from({ length: 200 }, (_, z) => ({ z, z_position_mm: -50 - z * 1.25 }));
const priSlices = Array.from({ length: 100 }, (_, z) => ({ z, z_position_mm: -40 - z * 2.5 }));
ok(priorSlice(80, { selZ: 80, pnZ: 40, curSlices, priSlices, nPrior: 100 }) === 40, 'key slice ↔ key slice');
ok(priorSlice(88, { selZ: 80, pnZ: 40, curSlices, priSlices, nPrior: 100 }) === 44, '10 mm further down → 4 prior slices of 2.5 mm (not 8)');
ok(priorSlice(80, { selZ: 80, pnZ: 40, nPrior: 100 }) === 40 && priorSlice(85, { selZ: 80, pnZ: 40, nPrior: 100 }) === 45, 'no slice positions → same index offset');
ok(priorSlice(0, { selZ: 80, pnZ: 2, nPrior: 100 }) === 0, 'clamped to the prior scan');
console.log(fail ? `${fail} failed` : 'all pass');
