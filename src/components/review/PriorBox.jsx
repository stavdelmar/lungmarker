import CropView from '@/components/CropView';
import { engine } from '@/api/engine';
import { fmtMaybe } from '@/components/review/viewerUtils';

export default function PriorBox({ base, priorScan, priorNodules, chosen, suggested }) {
  const label = chosen && chosen !== 'N/A' ? chosen : suggested;
  const pn = priorNodules.find((x) => x.nodule_label === label);
  return (
    <div className="rounded-md border border-slate-200 overflow-hidden">
      <div className="px-3 py-1.5 text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50 flex justify-between">
        <span>Prior scan {priorScan ? `· ${priorScan.timepoint} · ${priorScan.scan_date?.slice(0, 10)}` : ''}</span>
        {pn && <span className="normal-case tracking-normal">{chosen === label ? 'recorded match' : 'AI suggestion'}</span>}
      </div>
      {!priorScan && <div className="p-3 text-xs text-slate-400">Prior scan not synced yet.</div>}
      {priorScan && !pn && <div className="p-3 text-xs text-slate-400">{chosen === 'N/A' ? 'Recorded as a new nodule.' : 'No matched prior nodule.'}</div>}
      {pn && (
        <div className="flex gap-3 p-2.5">
          <CropView className="w-28 h-28 rounded" src={engine.sliceUrl(base, priorScan.engine_scan_id, 'lung', pn.key_slice_z)}
            focus={pn.key_contour_px?.length ? pn.key_contour_px : pn.long_axis_px || []}
            shapes={[...(pn.key_contour_px?.length > 2 ? [{ poly: pn.key_contour_px, color: '#5eead4' }] : []), ...(pn.long_axis_px ? [{ line: pn.long_axis_px, color: '#f0abfc' }] : [])]} />
          <div className="text-xs space-y-1">
            <div className="font-mono text-sm font-semibold">{pn.nodule_label} <span className="font-sans font-normal text-slate-500">{pn.lobe}</span></div>
            <div>Long <span className="font-mono">{fmtMaybe(pn.long_axis_mm)}</span> mm</div>
            <div>Short <span className="font-mono">{fmtMaybe(pn.short_axis_mm)}</span> mm</div>
            <div className="text-slate-500">{priorScan.review_status === 'Approved' ? `Approved by ${priorScan.approved_by_initials}` : 'Prior not yet approved'}</div>
          </div>
        </div>
      )}
    </div>
  );
}