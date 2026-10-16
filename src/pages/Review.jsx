import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { engine } from '@/api/engine';
import { useMe } from '@/hooks/useMe';
import { useSettings, useHealth } from '@/hooks/useAppData';
import { useScanTimer } from '@/hooks/useScanTimer';
import { initNodules, initNotFound } from '@/lib/initNodules';
import { saveNodule, logEvent, approveScan, markCentralChecked } from '@/lib/edits';
import { axesFromOutline, lenMm, meanOf, findingPatch, sliceStepMm, volumeAfterKeyEdit, volumeFromContours, sliceContour, allSliceContours, slicePatch, drawnSlices, interpolateSlices, handVolumeReady } from '@/lib/geometry';
import { brushEdit, lassoToPoly } from '@/lib/maskEdit';
import { MIN_LONG_AXIS_MM } from '@/lib/exportRows';
import { notFoundNote } from '@/lib/uncertainty';
import EngineOffline from '@/components/EngineOffline';
import ReviewHeader from '@/components/review/ReviewHeader';
import ViewerPane from '@/components/review/ViewerPane';
import NodulePanel from '@/components/review/NodulePanel';
import RejectDialog from '@/components/review/RejectDialog';

const { Scan, Nodule } = base44.entities;

export default function Review() {
  const { id } = useParams();
  const me = useMe();
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const base = settings?.engine_base_url;
  const scanQ = useQuery({ queryKey: ['scan', id], queryFn: () => Scan.get(id) });
  const scan = scanQ.data;
  const sid = scan?.engine_scan_id;
  const health = useHealth(base);
  const metaQ = useQuery({ queryKey: ['meta', base, sid], enabled: !!base && !!sid, retry: false, queryFn: () => engine.meta(base, sid) });
  const findQ = useQuery({ queryKey: ['findings', base, sid], enabled: !!base && !!sid, retry: false, queryFn: () => engine.findings(base, sid) });
  const nodQ = useQuery({ queryKey: ['nodules', id], enabled: !!scan, queryFn: async () => (await Nodule.filter({ scan: id }, { sort: 'key_slice_z', limit: 500 })).items });
  const priorId = scan?.prior_engine_scan_id;
  const priorQ = useQuery({
    queryKey: ['prior', priorId], enabled: !!priorId,
    queryFn: async () => {
      const s = (await Scan.filter({ engine_scan_id: priorId }, { limit: 1 })).items[0];
      return { scan: s || null, nodules: s ? (await Nodule.filter({ scan: s.id }, { sort: 'key_slice_z', limit: 500 })).items : [] };
    },
  });

  // Nodules in slice order (N1, N2 = order found), then the prior nodules "not found in this scan?".
  const nodules = useMemo(() => {
    const all = nodQ.data || [];
    return [...all.filter((n) => n.kind !== 'prior_not_found'), ...all.filter((n) => n.kind === 'prior_not_found')];
  }, [nodQ.data]);
  const meta = metaQ.data;
  const sp = meta?.pixel_spacing_mm || [1, 1];
  const nS = meta?.n_slices || meta?.slices?.length || scan?.n_slices || 1;
  const refineOk = !!health.data?.refine_available;
  const approved = scan?.review_status === 'Approved';
  const locked = !me.isReviewer || approved;
  const followup = !!scan && scan.timepoint !== 'Baseline';
  const priorNodules = (priorQ.data?.nodules || []).filter((n) => n.status !== 'Rejected');

  const [selId, setSelId] = useState(null);
  const [z, setZRaw] = useState(0);
  const [win, setWin] = useState('lung');
  const [mode, setMode] = useState(null);
  const [brushMm, setBrushMm] = useState(1.5);
  const undoRef = useRef([]);
  const [clicks, setClicks] = useState([]);
  const [showRejected, setShowRejected] = useState(false);
  const [draft, setDraft] = useState(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const draftRef = useRef(null);
  const sel = nodules.find((n) => n.id === selId);
  const setZ = (v) => setZRaw(Math.max(0, Math.min(nS - 1, v)));
  const step = (d) => setZRaw((v) => Math.max(0, Math.min(nS - 1, v + d)));

  useEffect(() => {
    const d = sel ? { key_contour_px: sel.key_contour_px || [], long_axis_px: sel.long_axis_px, short_axis_px: sel.short_axis_px } : null;
    draftRef.current = d; setDraft(d);
  }, [sel?.id, sel?.updated_date]);

  const timer = useScanTimer({ scanId: scan?.id, initial: scan?.active_seconds, initialTotal: scan?.total_seconds, enabled: !!scan && me.isReviewer && !approved, idleSeconds: settings?.idle_pause_seconds || 120 });

  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current || !scan || !me.isReviewer || scan.review_status !== 'Not started' || !nodQ.data || !findQ.data || health.isLoading || (priorId && !priorQ.data)) return;
    initRef.current = true;
    (async () => {
      const findings = findQ.data.findings || [];
      if (nodQ.data.length === 0) {
        await initNodules(scan, findings, priorQ.data?.nodules || []);
        if (scan.timepoint !== 'Baseline') await initNotFound(scan, findQ.data.match_summary, priorQ.data?.nodules || []);
      }
      await Scan.update(scan.id, { review_status: 'In review', first_opened_at: scan.first_opened_at || new Date().toISOString(), ai_findings_count: findings.length, engine_version: health.data?.engine_version || scan.engine_version || '' });
      qc.invalidateQueries({ queryKey: ['nodules', id] }); qc.invalidateQueries({ queryKey: ['scan', id] });
    })();
  }, [scan, me.isReviewer, nodQ.data, findQ.data, health.isLoading, priorQ.data]);

  const select = (n) => { setSelId(n.id); if (n.key_slice_z != null) setZ(n.key_slice_z); setMode(null); setClicks([]); };
  useEffect(() => { if (!selId && nodules.length) select(nodules[0]); }, [nodules.length]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['nodules', id] });
  const save = async (patch, opts) => {
    if (!sel) return;
    await saveNodule(scan, sel, patch, me, opts);
    if ('match_to_prior' in patch && sel.kind !== 'prior_not_found') await syncNotFound(sel, patch.match_to_prior);
    await refresh();
  };
  // A "prior Nx not found?" item resolves itself when Daniel matches a nodule in this scan to Nx (and reopens if he undoes it).
  const syncNotFound = async (n, label) => {
    const items = (nodQ.data || []).filter((x) => x.kind === 'prior_not_found');
    const hit = items.find((x) => x.prior_label === label && x.status === 'Pending');
    if (hit) await saveNodule(scan, hit, { status: 'Rejected', reject_reason: `Matched to ${n.nodule_label}` }, me);
    const old = items.find((x) => x.prior_label === n.match_to_prior && x.prior_label !== label && x.reject_reason === `Matched to ${n.nodule_label}`);
    if (old) await saveNodule(scan, old, { status: 'Pending', reject_reason: '' }, me);
  };
  const runEngine = async (fn) => {
    setBusy(true); setNotice('');
    try { await fn(); } catch (e) { setNotice(`AI engine is offline — ${e.message}`); }
    setBusy(false);
  };

  const findingsById = useMemo(() => Object.fromEntries((findQ.data?.findings || []).map((f) => [f.finding_id, f])), [findQ.data]);
  const shapes = useMemo(() => nodules.filter((n) => n.kind !== 'prior_not_found' && (showRejected || n.status !== 'Rejected')).map((n) => {
    let polys = [];
    if (z === n.key_slice_z) polys = [(n.id === selId ? draft?.key_contour_px : n.key_contour_px) || []];
    else if (n.source !== 'AI') {
      const { contours, filled } = interpolateSlices(drawnSlices(n), meta?.pixel_spacing_mm || [1, 1]);
      return { n, polys: contours[String(z)] || [], filled: filled.has(z) };
    } else polys = [sliceContour(n, z, findingsById[n.engine_finding_id]?.contours)];
    return { n, polys };
  }), [nodules, showRejected, z, selId, draft, findingsById, meta]);

  const onDrag = (h, pt) => setDraft((d) => {
    const key = h.kind === 'contour' ? 'key_contour_px' : h.kind;
    const nd = { ...d, [key]: d[key].map((p, i) => (i === h.idx ? pt : p)) };
    draftRef.current = nd; return nd;
  });
  // Hand-edited outline → the volume is recomputed at once in the browser (engine volume for the other
  // slices + the edited key slice), so a confirmed outline always has a volume. With a live engine, the
  // engine then redoes the 3D outline from Daniel's polygon and its volume replaces the browser one.
  const dz = sliceStepMm(meta, scan?.slice_thickness_mm);
  const contoursOf = (n) => findingsById[n.engine_finding_id]?.contours || {};
  const recomputeFromPolygon = (nid, poly) => runEngine(async () => {
    const fresh = await Nodule.get(nid);
    const f = await engine.refine(base, sid, { finding_id: fresh.engine_finding_id || null, z: fresh.key_slice_z, points: [], polygon_px: poly });
    if (f.volume_mm3 != null) await saveNodule(scan, fresh, { volume_mm3: Math.round(f.volume_mm3), volume_stale: false }, me);
    await refresh();
  });
  const onDragEnd = (h) => {
    const d = draftRef.current;
    if (h.kind === 'contour') {
      const vol = volumeAfterKeyEdit({ oldVolume: sel.volume_mm3, oldPoly: sel.key_contour_px, newPoly: d.key_contour_px, sp, dz, contoursByZ: contoursOf(sel), keyZ: sel.key_slice_z });
      const nid = sel.id;
      save({ key_contour_px: d.key_contour_px, volume_mm3: vol, volume_stale: false }, { source: 'points moved by hand; volume recomputed' })
        .then(() => { if (refineOk && sel.engine_finding_id) recomputeFromPolygon(nid, d.key_contour_px); });
    } else save({ [h.kind]: d[h.kind], [h.kind === 'long_axis_px' ? 'long_axis_mm' : 'short_axis_mm']: lenMm(d[h.kind], sp) });
  };

  // ---- Corrections without an engine: erase (E), draw (D), undo (Ctrl+Z) ----
  const brushPx = brushMm / (sp[1] || 1);
  const OUTLINE_FIELDS = ['key_contour_px', 'contour_edits', 'key_slice_z', 'slice_number', 'long_axis_px', 'short_axis_px', 'long_axis_mm', 'short_axis_mm', 'volume_mm3', 'volume_stale'];
  // Replace nodule n's outline on slice zz; axes (key slice) and volume update at once in the browser.
  const editSlice = async (n, zz, newPoly, source) => {
    const patch = slicePatch(n, zz, newPoly, { sp, dz, engineContours: contoursOf(n), slices: meta.slices });
    undoRef.current.push({ id: n.id, prev: Object.fromEntries(OUTLINE_FIELDS.map((f) => [f, n[f] ?? null])) });
    if (undoRef.current.length > 30) undoRef.current.shift();
    await saveNodule(scan, n, patch, me, { source });
    await refresh();
  };
  const undo = async () => {
    const last = undoRef.current.pop();
    if (!last) { setNotice('Nothing to undo.'); return; }
    const fresh = await Nodule.get(last.id);
    await saveNodule(scan, fresh, last.prev, me, { source: 'undo' });
    await refresh();
  };
  const onStrokeEnd = (points, e) => {
    if (locked) return;
    if (mode === 'erase' && sel) {
      const before = sliceContour(sel, z, contoursOf(sel), sp);
      if (!before.length && !e.shiftKey) { setNotice(`${sel.nodule_label} has no outline on this slice. Shift + drag paints one, or press D to draw it.`); return; }
      const after = brushEdit(before, points, brushPx, e.shiftKey ? 'paint' : 'erase');
      if (JSON.stringify(after) !== JSON.stringify(before)) editSlice(sel, z, after, e.shiftKey ? 'brush: painted' : 'brush: erased');
    } else if (mode === 'draw' && sel) {
      const poly = lassoToPoly(points);
      if (poly) editSlice(sel, z, poly, 'outline drawn by hand');
    }
  };

  const createAdded = async (geom) => {
    const maxN = Math.max(0, ...nodules.map((n) => parseInt(String(n.nodule_label).slice(1), 10) || 0));
    const label = `N${maxN + 1}`;
    const rec = await Nodule.create({
      scan: scan.id, engine_scan_id: sid, nodule_label: label, source: 'Added by reviewer', engine_finding_id: '', status: 'Pending',
      was_edited: false, lobe: '', type: 'Solid', slice_number: meta.slices?.find((s) => s.z === z)?.slice_number ?? z + 1, key_slice_z: z,
      outline_confirmed: false, match_to_prior: '', flags: [], ai_draft: {}, key_contour_px: [], contour_edits: {}, volume_stale: false, ...geom,
      mean_diameter_mm: meanOf(geom.long_axis_mm, geom.short_axis_mm),
    });
    await logEvent(scan, rec, 'added', '', label, me);
    await refresh(); setSelId(rec.id);
  };

  const quickRefine = (pt, label) => runEngine(async () => {
    const f = await engine.refine(base, sid, { finding_id: sel.engine_finding_id || null, z: sel.key_slice_z, points: [{ x: pt[0], y: pt[1], label }], polygon_px: draftRef.current?.key_contour_px });
    await save(findingPatch(f, sel.key_slice_z), { source: label ? 'AI grow click' : 'AI trim click' });
  });

  const onImageClick = (pt, e) => {
    if ((mode === 'trim' || mode === 'grow') && sel && !busy) {
      if (z !== sel.key_slice_z) { setNotice('Trim / grow works on the key slice of the selected nodule.'); return; }
      return quickRefine(pt, mode === 'grow' ? 1 : 0);
    }
    if (mode === 'fix') setClicks((c) => [...c, { x: pt[0], y: pt[1], label: e.shiftKey ? 0 : 1 }]);
    if (mode !== 'add') return;
    if (refineOk) {
      runEngine(async () => {
        const f = await engine.refine(base, sid, { finding_id: null, z, points: [{ x: pt[0], y: pt[1], label: 1 }] });
        await createAdded({ ...findingPatch(f, z), engine_finding_id: f.finding_id || '', flags: f.flags || [] });
        setMode(null);
      });
      return;
    }
    const c = [...clicks, { x: pt[0], y: pt[1], label: 1 }];
    if (c.length < 4) return setClicks(c);
    const L = [[c[0].x, c[0].y], [c[1].x, c[1].y]], S = [[c[2].x, c[2].y], [c[3].x, c[3].y]];
    createAdded({ long_axis_px: L, short_axis_px: S, long_axis_mm: lenMm(L, sp), short_axis_mm: lenMm(S, sp), volume_mm3: null });
    setMode(null); setClicks([]);
    setNotice('Nodule added with its axes. Volume stays empty unless you outline it (D) on its top, middle and bottom slices; the slices in between are filled in.');
  };

  const sendFix = () => runEngine(async () => {
    const f = await engine.refine(base, sid, { finding_id: sel.engine_finding_id || null, z: sel.key_slice_z, points: clicks, polygon_px: draft?.key_contour_px });
    await save(findingPatch(f, sel.key_slice_z), { source: 'AI redraw' });
    setMode(null); setClicks([]);
  });

  const next = () => {
    if (!nodules.length) return;
    const idx = nodules.findIndex((n) => n.id === selId);
    const order = [...nodules.slice(idx + 1), ...nodules.slice(0, idx + 1)];
    select(order.find((n) => n.status === 'Pending' && n.id !== selId) || order[0]);
  };
  const isNF = sel?.kind === 'prior_not_found';
  const under4 = !!sel && !isNF && !(Number(sel.long_axis_mm) >= MIN_LONG_AXIS_MM);
  const canAccept = !locked && !!sel && !under4 && (isNF || !followup || !!sel.match_to_prior);
  const accept = async () => {
    if (!canAccept) return;
    if (isNF) return confirmNotFound(sel, sel.notes || notFoundNote(sel));
    await save({ status: 'Accepted', reject_reason: '' }); next();
  };
  // Prior nodule not found: Daniel confirms it (exported as Match to prior = "Not found" + his note), or says it is here.
  const confirmNotFound = async (n, note) => {
    await saveNodule(scan, n, { status: 'Accepted', reject_reason: '', match_to_prior: 'Not found', notes: note ?? n.notes ?? '' }, me);
    await refresh(); next();
  };
  const notFoundIsHere = async (n) => {
    await saveNodule(scan, n, { status: 'Rejected', reject_reason: 'Seen in this scan', match_to_prior: '' }, me);
    await refresh();
    setMode('add'); setClicks([]);
    setNotice(`Mark prior ${n.prior_label} on this scan: ${refineOk ? 'click it' : '4 clicks for its axes'}, then set its Match to prior to ${n.prior_label}. If the AI already marked it under another number, select that nodule and set Match to prior to ${n.prior_label} instead.`);
  };
  const reject = async (reason) => { await save({ status: 'Rejected', reject_reason: reason }); next(); };
  const allDone = nodules.every((n) => n.status === 'Accepted' || n.status === 'Rejected');

  // Required step before approval: the AI misses central tumours (hilum / mediastinum), so Daniel confirms he checked there.
  const centralDone = !!scan?.central_checked_at;
  const checkCentral = async (done) => {
    await markCentralChecked(scan, me, done);
    qc.invalidateQueries({ queryKey: ['scan', id] });
  };
  const approve = async () => {
    if (!centralDone || !allDone) return;
    await approveScan(scan, timer.getSecs(), me, timer.getTotal());
    qc.invalidateQueries({ queryKey: ['scan', id] }); qc.invalidateQueries({ queryKey: ['approvedScans'] }); qc.invalidateQueries({ queryKey: ['resultNodules'] });
  };
  const reopen = async () => {
    await Scan.update(scan.id, { review_status: 'In review' });
    await logEvent(scan, null, 'scan_approved', 'Approved', 'Reopened', me);
    qc.invalidateQueries({ queryKey: ['scan', id] });
  };

  const keys = useRef();
  keys.current = { accept, next, canAct: !locked && !!sel, reject: () => setRejectOpen(true), step, quick: !locked && !!sel && refineOk && !!meta, edit: !locked && !!sel && !!meta, setMode, undo, setBrushMm, jump: () => sel && setZ(sel.key_slice_z) };
  useEffect(() => {
    const h = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const k = keys.current;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { if (k.edit) { e.preventDefault(); k.undo(); } return; }
      if (e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowUp') { e.preventDefault(); k.step(-1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); k.step(1); }
      else if (e.key === 'Escape') { setMode(null); setClicks([]); }
      else if (e.key.toLowerCase() === 'n') k.next();
      else if (k.canAct && e.key.toLowerCase() === 'a') k.accept();
      else if (k.canAct && e.key.toLowerCase() === 'r') k.reject();
      else if (k.quick && e.key.toLowerCase() === 't') { k.jump(); k.setMode((m) => (m === 'trim' ? null : 'trim')); }
      else if (k.quick && e.key.toLowerCase() === 'g') { k.jump(); k.setMode((m) => (m === 'grow' ? null : 'grow')); }
      else if (k.edit && e.key.toLowerCase() === 'e') k.setMode((m) => (m === 'erase' ? null : 'erase'));
      else if (k.edit && e.key.toLowerCase() === 'd') k.setMode((m) => (m === 'draw' ? null : 'draw'));
      else if (e.key === '[') k.setBrushMm((b) => Math.max(0.5, Math.round((b - 0.5) * 10) / 10));
      else if (e.key === ']') k.setBrushMm((b) => Math.min(6, Math.round((b + 0.5) * 10) / 10));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  if (!scan || !settings) return <div className="flex-1 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;

  const aiLabel = sel && (sel.ai_draft?.match_label || priorNodules.find((p) => p.engine_finding_id === sel.ai_draft?.match?.prior_finding_id)?.nodule_label);
  const conf = sel?.ai_draft?.match?.confidence;
  const aiSuggest = aiLabel ? { label: aiLabel, conf: conf == null ? null : Math.round(conf <= 1 ? conf * 100 : conf) } : null;
  const retry = () => { metaQ.refetch(); findQ.refetch(); health.refetch(); };

  const modeBar = mode && (
    <div className="flex items-center gap-3 px-3 py-2 bg-teal-950/60 border-b border-teal-800 text-xs text-teal-100">
      {mode === 'fix' && <span>Click inside the nodule = part of nodule · Shift+click = not nodule · <span className="font-mono">{clicks.length}</span> points</span>}
      {mode === 'trim' && <span><b>Trim −</b> · click on a vessel tail or anything that is not nodule; the AI redraws at once. Click again to trim more. Esc when done.</span>}
      {mode === 'grow' && <span><b>Grow +</b> · click on nodule tissue the outline missed; the AI redraws at once. Esc when done.</span>}
      {mode === 'erase' && <span><b>Erase</b> · drag over the part to cut away (e.g. a vessel tail). A piece cut off from the nodule disappears. Shift + drag paints back · brush <span className="font-mono">{brushMm} mm</span> ([ ]) · Ctrl+Z undo · works on any slice · Esc when done</span>}
      {mode === 'draw' && <span><b>Draw</b> · drag around the nodule to outline it on this slice. {sel && sel.source !== 'AI' ? <>For a volume, outline its <b>top, middle and bottom</b> slices; the slices in between are filled in (dashed). <span className="font-mono">{Object.keys(drawnSlices(sel)).length}</span> outlined.</> : 'Replaces the outline on this slice.'} Ctrl+Z undo · Esc when done</span>}
      {mode === 'add' && <span>{refineOk ? 'Click on the nodule the AI missed.' : <>On the slice where it looks largest: click the two ends of the <b>long axis</b>, then the two ends of the <b>short axis</b> (<span className="font-mono">{clicks.length}/4</span>).</>}</span>}
      {mode === 'fix' && <button disabled={!clicks.length || busy} onClick={sendFix} className="ml-auto h-7 px-3 rounded bg-teal-400 text-teal-950 font-medium disabled:opacity-50">Send</button>}
      {busy && (mode === 'trim' || mode === 'grow') && <span className="ml-auto text-teal-200">AI is redrawing…</span>}
      <button onClick={() => { setMode(null); setClicks([]); }} className={`${mode === 'fix' || busy ? '' : 'ml-auto'} h-7 px-3 rounded border border-teal-700 hover:bg-teal-900`}>{['trim', 'grow', 'erase', 'draw'].includes(mode) ? 'Done' : 'Cancel'}</button>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-72px)]">
      <ReviewHeader scan={scan} timer={timer} showTimer={me.isReviewer && !approved} readOnly={locked} />
      <div className="flex flex-1 min-h-0">
        <div className="w-[65%] flex flex-col min-w-0 bg-neutral-950">
          {notice && <div className="px-3 py-2 text-xs bg-rose-950/60 text-rose-100 border-b border-rose-900 flex">{notice}<button className="ml-auto underline" onClick={() => setNotice('')}>Dismiss</button></div>}
          {metaQ.isError || findQ.isError || (!base) ? (
            <div className="p-6"><EngineOffline dark onRetry={retry} message={metaQ.error?.message || findQ.error?.message || 'Engine URL is not set (Settings).'} /></div>
          ) : !meta ? (
            <div className="flex-1 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-neutral-500" /></div>
          ) : (
            <ViewerPane meta={meta} base={base} sid={sid} z={z} step={step} setZ={setZ} win={win} setWin={setWin} nodules={nodules} shapes={shapes}
              sel={sel} draft={draft} editable={!locked} mode={mode} clicks={clicks} onSelect={select} onImageClick={onImageClick}
              onDrag={onDrag} onDragEnd={onDragEnd} showRejected={showRejected} setShowRejected={setShowRejected} modeBar={modeBar} busy={busy}
              onStrokeEnd={onStrokeEnd} brushPx={brushPx} />
          )}
        </div>
        <NodulePanel scan={scan} nodules={nodules} sel={sel} onSelect={select} locked={locked} isReviewer={me.isReviewer} followup={followup}
          adding={mode === 'add'} onAdd={() => { setMode(mode === 'add' ? null : 'add'); setClicks([]); }}
          canAccept={canAccept} under4={under4} onAccept={accept}
          notFound={{ onConfirm: confirmNotFound, onHere: notFoundIsHere, onReopen: (n) => saveNodule(scan, n, { status: 'Pending', reject_reason: '', match_to_prior: '' }, me).then(refresh) }}
          central={{ done: centralDone, by: scan.central_checked_by_initials, at: scan.central_checked_at, onCheck: () => checkCentral(true), onUndo: () => checkCentral(false),
            onMediastinal: (meta?.windows || []).includes('mediastinal') ? () => setWin('mediastinal') : null, win }} onRejectClick={() => setRejectOpen(true)} onNext={next} allDone={allDone} onApprove={approve} onReopen={reopen}
          prior={{ base, priorScan: priorQ.data?.scan, priorNodules }}
          formProps={{
            priorLabels: priorNodules.map((p) => p.nodule_label), aiSuggest, onSave: save,
            outline: {
              refineOk: refineOk && !!meta,
              onConfirm: () => {
                if (sel.source !== 'AI' && !handVolumeReady(drawnSlices(sel))) { setNotice(`To record a volume for ${sel.nodule_label}, outline it (D) on its top, middle and bottom slices; the slices in between are filled in. Without that, leave the outline unconfirmed: Volume stays empty.`); return; }
                const vol = sel.volume_mm3 ?? volumeFromContours(allSliceContours(sel, contoursOf(sel), sp), sp, dz);
                if (vol == null) { setNotice('Cannot confirm: no volume could be measured from this outline. Draw it (D) or reset it to the AI.'); return; }
                save({ outline_confirmed: true, outline_confirmed_by_initials: me.initials, outline_confirmed_at: new Date().toISOString(), volume_mm3: vol, volume_stale: false });
              },
              onReset: () => save({ key_contour_px: sel.ai_draft.contour, contour_edits: {}, volume_mm3: sel.ai_draft.volume ?? null, volume_stale: false,
                ...(sel.ai_draft.long_axis_px ? { long_axis_px: sel.ai_draft.long_axis_px, short_axis_px: sel.ai_draft.short_axis_px, long_axis_mm: sel.ai_draft.long, short_axis_mm: sel.ai_draft.short } : {}) }, { source: 'reset to AI' }),
              onErase: () => setMode(mode === 'erase' ? null : 'erase'),
              onDraw: () => setMode(mode === 'draw' ? null : 'draw'),
              onUndo: undo,
              onTrim: () => { setZ(sel.key_slice_z); setMode(mode === 'trim' ? null : 'trim'); setClicks([]); },
              onGrow: () => { setZ(sel.key_slice_z); setMode(mode === 'grow' ? null : 'grow'); setClicks([]); },
              quickMode: mode,
              onRecalc: () => { const r = axesFromOutline(draft?.key_contour_px, sp); if (r) save(r); },
              onFix: () => { setZ(sel.key_slice_z); setMode('fix'); setClicks([]); },
            },
          }} />
      </div>
      <RejectDialog open={rejectOpen} onOpenChange={setRejectOpen} label={sel?.nodule_label} onReject={reject} />
    </div>
  );
}