import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { engine } from '@/api/engine';
import { useMe } from '@/hooks/useMe';
import { useSettings, useHealth } from '@/hooks/useAppData';
import { useScanTimer } from '@/hooks/useScanTimer';
import { initNodules } from '@/lib/initNodules';
import { saveNodule, logEvent } from '@/lib/edits';
import { axesFromOutline, lenMm, meanOf, findingPatch } from '@/lib/geometry';
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

  const nodules = nodQ.data || [];
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

  const timer = useScanTimer({ scanId: scan?.id, initial: scan?.active_seconds, enabled: !!scan && me.isReviewer && !approved, idleSeconds: settings?.idle_pause_seconds || 120 });

  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current || !scan || !me.isReviewer || scan.review_status !== 'Not started' || !nodQ.data || !findQ.data || health.isLoading || (priorId && !priorQ.data)) return;
    initRef.current = true;
    (async () => {
      const findings = findQ.data.findings || [];
      if (nodQ.data.length === 0) await initNodules(scan, findings, priorQ.data?.nodules || []);
      await Scan.update(scan.id, { review_status: 'In review', ai_findings_count: findings.length, engine_version: health.data?.engine_version || scan.engine_version || '' });
      qc.invalidateQueries({ queryKey: ['nodules', id] }); qc.invalidateQueries({ queryKey: ['scan', id] });
    })();
  }, [scan, me.isReviewer, nodQ.data, findQ.data, health.isLoading, priorQ.data]);

  const select = (n) => { setSelId(n.id); setZ(n.key_slice_z ?? 0); setMode(null); setClicks([]); };
  useEffect(() => { if (!selId && nodules.length) select(nodules[0]); }, [nodules.length]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['nodules', id] });
  const save = async (patch, opts) => { if (!sel) return; await saveNodule(scan, sel, patch, me, opts); await refresh(); };
  const runEngine = async (fn) => {
    setBusy(true); setNotice('');
    try { await fn(); } catch (e) { setNotice(`AI engine is offline — ${e.message}`); }
    setBusy(false);
  };

  const findingsById = useMemo(() => Object.fromEntries((findQ.data?.findings || []).map((f) => [f.finding_id, f])), [findQ.data]);
  const shapes = useMemo(() => nodules.filter((n) => showRejected || n.status !== 'Rejected').map((n) => {
    let polys = [];
    if (z === n.key_slice_z) polys = [(n.id === selId ? draft?.key_contour_px : n.key_contour_px) || []];
    else if (n.engine_finding_id) polys = findingsById[n.engine_finding_id]?.contours?.[String(z)] || [];
    return { n, polys };
  }), [nodules, showRejected, z, selId, draft, findingsById]);

  const onDrag = (h, pt) => setDraft((d) => {
    const key = h.kind === 'contour' ? 'key_contour_px' : h.kind;
    const nd = { ...d, [key]: d[key].map((p, i) => (i === h.idx ? pt : p)) };
    draftRef.current = nd; return nd;
  });
  const onDragEnd = (h) => {
    const d = draftRef.current;
    if (h.kind === 'contour') save({ key_contour_px: d.key_contour_px });
    else save({ [h.kind]: d[h.kind], [h.kind === 'long_axis_px' ? 'long_axis_mm' : 'short_axis_mm']: lenMm(d[h.kind], sp) });
  };

  const createAdded = async (geom) => {
    const maxN = Math.max(0, ...nodules.map((n) => parseInt(String(n.nodule_label).slice(1), 10) || 0));
    const label = `N${maxN + 1}`;
    const rec = await Nodule.create({
      scan: scan.id, engine_scan_id: sid, nodule_label: label, source: 'Added by reviewer', engine_finding_id: '', status: 'Pending',
      was_edited: false, lobe: '', type: 'Solid', slice_number: meta.slices?.find((s) => s.z === z)?.slice_number ?? z + 1, key_slice_z: z,
      outline_confirmed: false, match_to_prior: '', flags: [], ai_draft: {}, key_contour_px: [], ...geom,
      mean_diameter_mm: meanOf(geom.long_axis_mm, geom.short_axis_mm),
    });
    await logEvent(scan, rec, 'added', '', label, me);
    await refresh(); setSelId(rec.id);
  };

  const onImageClick = (pt, e) => {
    if (mode === 'fix') setClicks((c) => [...c, { x: pt[0], y: pt[1], label: e.shiftKey ? 0 : 1 }]);
    if (mode !== 'add') return;
    if (refineOk) {
      runEngine(async () => {
        const f = await engine.refine(base, sid, { finding_id: null, z, points: [{ x: pt[0], y: pt[1], label: 1 }] });
        await createAdded({ ...findingPatch(f, z), flags: f.flags || [] });
        setMode(null);
      });
      return;
    }
    const c = [...clicks, { x: pt[0], y: pt[1], label: 1 }];
    if (c.length < 4) return setClicks(c);
    const L = [[c[0].x, c[0].y], [c[1].x, c[1].y]], S = [[c[2].x, c[2].y], [c[3].x, c[3].y]];
    createAdded({ long_axis_px: L, short_axis_px: S, long_axis_mm: lenMm(L, sp), short_axis_mm: lenMm(S, sp) });
    setMode(null); setClicks([]);
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
  const canAccept = !locked && !!sel && (!followup || !!sel.match_to_prior);
  const accept = async () => { if (!canAccept) return; await save({ status: 'Accepted', reject_reason: '' }); next(); };
  const reject = async (reason) => { await save({ status: 'Rejected', reject_reason: reason }); next(); };
  const allDone = nodules.every((n) => n.status === 'Accepted' || n.status === 'Rejected');

  const approve = async () => {
    const secs = timer.getSecs();
    await Scan.update(scan.id, { review_status: 'Approved', approved_by_email: me.user.email, approved_by_initials: me.initials, approved_at: new Date().toISOString(), active_seconds: secs, minutes_on_scan: Math.ceil(secs / 60) });
    await logEvent(scan, null, 'scan_approved', 'In review', 'Approved', me);
    qc.invalidateQueries({ queryKey: ['scan', id] });
  };
  const reopen = async () => {
    await Scan.update(scan.id, { review_status: 'In review' });
    await logEvent(scan, null, 'scan_approved', 'Approved', 'Reopened', me);
    qc.invalidateQueries({ queryKey: ['scan', id] });
  };

  const keys = useRef();
  keys.current = { accept, next, canAct: !locked && !!sel, reject: () => setRejectOpen(true), step };
  useEffect(() => {
    const h = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.ctrlKey || e.metaKey) return;
      const k = keys.current;
      if (e.key === 'ArrowUp') { e.preventDefault(); k.step(-1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); k.step(1); }
      else if (e.key === 'Escape') { setMode(null); setClicks([]); }
      else if (e.key.toLowerCase() === 'n') k.next();
      else if (k.canAct && e.key.toLowerCase() === 'a') k.accept();
      else if (k.canAct && e.key.toLowerCase() === 'r') k.reject();
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
      {mode === 'add' && <span>{refineOk ? 'Click on the nodule the AI missed.' : `Click the long axis ends, then the short axis ends (${clicks.length}/4).`}</span>}
      {mode === 'fix' && <button disabled={!clicks.length || busy} onClick={sendFix} className="ml-auto h-7 px-3 rounded bg-teal-400 text-teal-950 font-medium disabled:opacity-50">Send</button>}
      <button onClick={() => { setMode(null); setClicks([]); }} className={`${mode === 'fix' ? '' : 'ml-auto'} h-7 px-3 rounded border border-teal-700 hover:bg-teal-900`}>Cancel</button>
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
              onDrag={onDrag} onDragEnd={onDragEnd} showRejected={showRejected} setShowRejected={setShowRejected} modeBar={modeBar} busy={busy} />
          )}
        </div>
        <NodulePanel scan={scan} nodules={nodules} sel={sel} onSelect={select} locked={locked} isReviewer={me.isReviewer} followup={followup}
          adding={mode === 'add'} onAdd={() => { setMode(mode === 'add' ? null : 'add'); setClicks([]); }}
          canAccept={canAccept} onAccept={accept} onRejectClick={() => setRejectOpen(true)} onNext={next} allDone={allDone} onApprove={approve} onReopen={reopen}
          prior={{ base, priorScan: priorQ.data?.scan, priorNodules }}
          formProps={{
            priorLabels: priorNodules.map((p) => p.nodule_label), aiSuggest, onSave: save,
            outline: {
              refineOk: refineOk && !!meta,
              onConfirm: () => save({ outline_confirmed: true, outline_confirmed_by_initials: me.initials, outline_confirmed_at: new Date().toISOString() }),
              onReset: () => save({ key_contour_px: sel.ai_draft.contour }),
              onRecalc: () => { const r = axesFromOutline(draft?.key_contour_px, sp); if (r) save(r); },
              onFix: () => { setZ(sel.key_slice_z); setMode('fix'); setClicks([]); },
            },
          }} />
      </div>
      <RejectDialog open={rejectOpen} onOpenChange={setRejectOpen} label={sel?.nodule_label} onReject={reject} />
    </div>
  );
}