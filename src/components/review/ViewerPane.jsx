import { useEffect, useState } from 'react';
import { Minus, Plus, Maximize2, Loader2 } from 'lucide-react';
import { engine } from '@/api/engine';
import { lenMm, fmtMaybe } from '@/components/review/viewerUtils';
import Viewer from '@/components/review/Viewer';
import Overlay from '@/components/review/Overlay';
import SliceSlider from '@/components/review/SliceSlider';

const btn = 'h-7 px-2.5 rounded text-xs border border-neutral-700 text-neutral-300 hover:bg-neutral-800';

export default function ViewerPane(p) {
  const { meta, base, sid, z, step, setZ, win, setWin, nodules, shapes, sel, draft, editable, mode, clicks, onSelect, onImageClick, onDrag, onDragEnd, showRejected, setShowRejected, modeBar, busy, onStrokeEnd, brushPx } = p;
  const strokeMode = mode === 'erase' || mode === 'draw';
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const n = meta.n_slices || meta.slices?.length || 1;
  const sliceNo = meta.slices?.find((s) => s.z === z)?.slice_number ?? z + 1;
  const sp = meta.pixel_spacing_mm || [1, 1];
  const isKey = !!sel && z === sel.key_slice_z;

  useEffect(() => {
    const h = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === '+' || e.key === '=') setZoom((v) => Math.min(10, v * 1.2));
      if (e.key === '-') setZoom((v) => Math.max(0.5, v / 1.2));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-neutral-950 text-neutral-200">
      <div className="h-10 flex items-center gap-2 px-3 border-b border-neutral-800 text-xs">
        {(meta.windows || ['lung']).map((w) => (
          <button key={w} onClick={() => setWin(w)} className={`${btn} capitalize ${win === w ? 'bg-neutral-200 text-neutral-900 border-neutral-200 hover:bg-neutral-200' : ''}`}>{w}</button>
        ))}
        <span className="w-px h-5 bg-neutral-800 mx-1" />
        <button className={btn} onClick={() => setZoom((v) => Math.max(0.5, v / 1.2))}><Minus className="w-3 h-3" /></button>
        <span className="font-mono w-10 text-center text-neutral-400">{Math.round(zoom * 100)}%</span>
        <button className={btn} onClick={() => setZoom((v) => Math.min(10, v * 1.2))}><Plus className="w-3 h-3" /></button>
        <button className={btn} onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}><Maximize2 className="w-3 h-3" /></button>
        <label className="flex items-center gap-1.5 ml-2 text-neutral-400 cursor-pointer">
          <input type="checkbox" checked={showRejected} onChange={(e) => setShowRejected(e.target.checked)} className="accent-teal-400" /> Show rejected
        </label>
        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-300 ml-2" />}
        <div className="ml-auto flex items-center gap-4 font-mono">
          {isKey && draft && <span className="text-fuchsia-300">L {fmtMaybe(lenMm(draft.long_axis_px, sp))} · S {fmtMaybe(lenMm(draft.short_axis_px, sp))} mm</span>}
          <span>Slice #{sliceNo} <span className="text-neutral-500">({z + 1}/{n})</span></span>
        </div>
      </div>
      {modeBar}
      <div className="flex flex-1 min-h-0">
        <Viewer src={engine.sliceUrl(base, sid, win, z)} cols={meta.cols} rows={meta.rows} zoom={zoom} setZoom={setZoom} pan={pan} setPan={setPan}
          onStep={step} onImageClick={onImageClick} onDrag={onDrag} onDragEnd={onDragEnd} cursor={mode === 'erase' ? 'none' : mode ? 'crosshair' : 'default'}
          strokeMode={strokeMode} onStrokeEnd={onStrokeEnd}>
          {({ scale, startDrag, stroke, hover }) => (
            <Overlay shapes={shapes} selId={sel?.id} draft={draft} isKey={isKey} editable={editable && !mode} scale={scale}
              startDrag={startDrag} onSelect={onSelect} clicks={clicks} interactive={!mode} tool={mode} stroke={stroke} hover={hover} brushPx={brushPx} />
          )}
        </Viewer>
        <SliceSlider z={z} n={n} onChange={setZ}
          ticks={nodules.filter((x) => showRejected || x.status !== 'Rejected').map((x) => ({ id: x.id, z: x.key_slice_z, label: x.nodule_label, sel: x.id === sel?.id }))} />
      </div>
    </div>
  );
}