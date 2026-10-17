import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { engine } from '@/api/engine';
import { boxOf } from '@/components/review/viewerUtils';
import Viewer from '@/components/review/Viewer';

const pts = (p) => p.map((q) => q.join(',')).join(' ');
const noop = () => {};

// Left half of the split view: the prior scan on the chosen prior nodule. Scrolling moves the current scan;
// the prior follows to the matching slice (same offset from each nodule's key slice).
export default function PriorPane({ base, priorScan, pn, sel, z, step, onClose }) {
  const sid = priorScan.engine_scan_id;
  const metaQ = useQuery({ queryKey: ['meta', base, sid], enabled: !!base && !!sid, retry: false, queryFn: () => engine.meta(base, sid) });
  const meta = metaQ.data;
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const box = useMemo(() => boxOf(pn), [pn.id]);
  const focus = useMemo(() => (box ? { id: pn.id, box } : null), [pn.id, box]);
  const n = meta ? meta.n_slices || meta.slices?.length || 1 : 1;
  const pz = Math.max(0, Math.min(n - 1, (pn.key_slice_z ?? 0) + (z - (sel?.key_slice_z ?? z))));
  const sliceNo = meta?.slices?.find((s) => s.z === pz)?.slice_number ?? pz + 1;
  const isKey = pz === pn.key_slice_z;
  return (
    <div className="relative flex flex-1 min-w-0">
      <div className="absolute left-3 top-2 z-10 pointer-events-none font-mono text-[12px] leading-5 text-neutral-200 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
        <div className="text-amber-300">Prior · {priorScan.timepoint} · {priorScan.scan_date?.slice(0, 10)}</div>
        <div>Slice #{sliceNo} <span className="text-neutral-400">({pz + 1}/{n})</span></div>
        <div className="text-teal-300">{pn.nodule_label}{isKey ? '' : <span className="text-neutral-400"> · not its key slice</span>}</div>
      </div>
      <button onClick={onClose} className="absolute right-2 top-2 z-10 h-7 px-2.5 rounded text-xs bg-neutral-800 border border-neutral-600 text-neutral-100 hover:bg-neutral-700 flex items-center gap-1"><X className="w-3.5 h-3.5" />Close prior</button>
      {meta ? (
        <Viewer src={engine.sliceUrl(base, sid, 'lung', pz)} cols={meta.cols} rows={meta.rows} zoom={zoom} setZoom={setZoom} pan={pan} setPan={setPan}
          onStep={step} onImageClick={noop} onDrag={noop} onDragEnd={noop} cursor="default" focus={focus}>
          {({ scale }) => (
            <g>
              {isKey && pn.key_contour_px?.length > 2 && <polygon points={pts(pn.key_contour_px)} fill="none" stroke="#5eead4" strokeWidth={1.5 / scale} />}
              {isKey && pn.long_axis_px && <line x1={pn.long_axis_px[0][0]} y1={pn.long_axis_px[0][1]} x2={pn.long_axis_px[1][0]} y2={pn.long_axis_px[1][1]} stroke="#f0abfc" strokeWidth={1.5 / scale} />}
            </g>
          )}
        </Viewer>
      ) : <div className="flex-1 grid place-items-center text-xs text-neutral-500">{metaQ.isError ? 'Prior scan images unavailable.' : 'Loading prior…'}</div>}
    </div>
  );
}