import { useState } from 'react';
import { Columns2 } from 'lucide-react';
import CropView from '@/components/CropView';
import { engine } from '@/api/engine';
import { fmtMaybe, boxOf } from '@/components/review/viewerUtils';

const shapesOf = (n) => [...(n.key_contour_px?.length > 2 ? [{ poly: n.key_contour_px, color: '#5eead4' }] : []), ...(n.long_axis_px ? [{ line: n.long_axis_px, color: '#f0abfc' }] : [])];
const focusOf = (n) => (n.key_contour_px?.length ? n.key_contour_px : n.long_axis_px || []);
const sizeOf = (n) => { const b = boxOf(n); return b ? Math.max(b[2] - b[0], b[3] - b[1]) / 2 + 40 : 60; };
const num = (l) => parseInt(String(l).slice(1), 10) || 0;
const btn = 'h-9 px-3 rounded-md text-sm font-medium border flex items-center justify-center gap-1.5 disabled:opacity-40';

// Step 3: the AI-suggested prior nodule next to the current one (same zoom), then Same / others / New.
export default function MatchCompare({ sel, nodules, prior, aiSuggest, locked, onSave, onOpenPrior }) {
  const { base, priorScan, priorNodules } = prior;
  const recorded = sel.match_to_prior && sel.match_to_prior !== 'N/A' ? sel.match_to_prior : null;
  const [cand, setCand] = useState(recorded || aiSuggest?.label || null);
  const [others, setOthers] = useState(false);
  if (!priorScan) return <p className="text-xs text-slate-500">Prior scan not synced yet.</p>;
  const pn = priorNodules.find((x) => x.nodule_label === cand);
  const matchedBy = (label) => nodules.find((n) => n.id !== sel.id && n.match_to_prior === label)?.nodule_label;
  const half = pn ? Math.max(sizeOf(pn), sizeOf(sel)) : null;
  const diff = pn && sel.long_axis_mm != null && pn.long_axis_mm != null ? sel.long_axis_mm - pn.long_axis_mm : null;
  const rest = [...priorNodules].filter((x) => x.nodule_label !== cand).sort((a, b) => num(a.nodule_label) - num(b.nodule_label));
  const card = (n, title, scanId) => (
    <div className="flex-1 min-w-0">
      <div className="text-[11px] text-slate-500 mb-1 truncate">{title}</div>
      <CropView className="w-full aspect-square rounded" src={engine.sliceUrl(base, scanId, 'lung', n.key_slice_z)} focus={focusOf(n)} half={half} shapes={shapesOf(n)} />
      <div className="mt-1 text-xs"><b className="font-mono">{n.nodule_label}</b> · {n.lobe || '—'} · long <span className="font-mono">{fmtMaybe(n.long_axis_mm)}</span> mm</div>
    </div>
  );
  return (
    <div className="space-y-2.5">
      <div className="text-[11.5px] text-slate-600">
        {pn ? (cand === aiSuggest?.label ? <>AI suggests <b className="font-mono">{cand}</b>{aiSuggest.conf != null && <>, confidence <span className="font-mono">{aiSuggest.conf}%</span></>}</> : <>Comparing with prior <b className="font-mono">{cand}</b></>) : 'No AI suggestion. Pick a prior nodule below, or mark it as new.'}
        {recorded && <> · recorded: <b className="font-mono">{recorded}</b></>}{sel.match_to_prior === 'N/A' && <> · recorded: <b>new nodule</b></>}
      </div>
      {pn && (
        <>
          <div className="flex gap-2">{card(pn, `Prior · ${priorScan.timepoint} · ${priorScan.scan_date?.slice(0, 10)}`, priorScan.engine_scan_id)}{card(sel, 'Current', sel.engine_scan_id)}</div>
          <div className="flex items-center text-xs">
            {diff != null && <span>Change in long axis: <b className="font-mono">{diff >= 0 ? '+' : '−'}{fmtMaybe(Math.abs(diff))} mm</b></span>}
            <button onClick={() => onOpenPrior(pn)} className="ml-auto text-teal-700 hover:underline flex items-center gap-1"><Columns2 className="w-3.5 h-3.5" />Open prior side by side</button>
          </div>
        </>
      )}
      {!locked && (
        <div className="grid grid-cols-3 gap-1.5">
          <button disabled={!pn} onClick={() => onSave({ match_to_prior: cand })} className={`${btn} bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700`}>Same nodule{pn ? ` (${cand})` : ''}</button>
          <button onClick={() => setOthers(!others)} className={`${btn} bg-white border-slate-300 hover:bg-slate-50 ${others ? 'ring-2 ring-slate-300' : ''}`}>Not this one, show others</button>
          <button onClick={() => onSave({ match_to_prior: 'N/A' })} className={`${btn} bg-white border-slate-300 hover:bg-slate-50 ${sel.match_to_prior === 'N/A' ? 'ring-2 ring-teal-500' : ''}`}>New nodule (N/A)</button>
        </div>
      )}
      {others && (
        rest.length ? (
          <div className="grid grid-cols-3 gap-2">
            {rest.map((x) => (
              <button key={x.id} onClick={() => { setCand(x.nodule_label); setOthers(false); onOpenPrior(x); }} className="text-left rounded-md border border-slate-200 bg-white p-1.5 hover:border-teal-500">
                <CropView className="w-full aspect-square rounded" src={engine.sliceUrl(base, priorScan.engine_scan_id, 'lung', x.key_slice_z)} focus={focusOf(x)} shapes={shapesOf(x)} />
                <div className="mt-1 text-[11px]"><b className="font-mono">{x.nodule_label}</b> · {x.lobe || '—'} · <span className="font-mono">{fmtMaybe(x.long_axis_mm)}</span> mm</div>
                {matchedBy(x.nodule_label) && <div className="text-[10.5px] text-amber-700">already matched to {matchedBy(x.nodule_label)}</div>}
              </button>
            ))}
          </div>
        ) : <p className="text-xs text-slate-500">No other prior nodules.</p>
      )}
    </div>
  );
}