import { useRef } from 'react';

// Same colour rule as chips and image outlines (see lib/noduleTone).
// Colour = state only; the selected nodule's mark is longer and thicker (same colour). Rejected = red dashed line
// (no fill), shown only with "Show rejected". Kept separate from the size classes so they never conflict.
const FILL = { pending: 'bg-slate-400', accepted: 'bg-emerald-400', unsure: 'bg-amber-400' };

export default function SliceSlider({ z, n, ticks, onChange, range }) {
  const ref = useRef();
  const pos = (v) => `${(v / Math.max(1, n - 1)) * 100}%`;
  const set = (e) => {
    const r = ref.current.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    onChange(Math.round(t * (n - 1)));
  };
  return (
    <div className="w-8 py-4 bg-neutral-900 border-l border-neutral-800 flex justify-center">
      <div ref={ref} className="relative w-5 h-full cursor-pointer"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); set(e); }}
        onPointerMove={(e) => e.buttons === 1 && set(e)}>
        <div className="absolute left-1/2 -translate-x-1/2 inset-y-0 w-px bg-neutral-700" />
        {range && ( /* selected nodule's outline range: thin neutral bracket, first → last slice */
          <div title={`Outline: slices ${range.firstNum}–${range.lastNum}`} className="absolute -left-0.5 w-1 border-l border-y border-neutral-300 rounded-l-sm"
            style={{ top: pos(range.first), height: `calc(${pos(range.last)} - ${pos(range.first)})`, minHeight: 3 }} />
        )}
        {ticks.map((t) => (t.color === 'rejected' ? (
          <div key={t.id} title={`${t.label} · rejected`} data-tone="rejected" className={`absolute -translate-y-1/2 border-dashed border-red-400 ${t.sel ? '-left-1 -right-1 border-t-[3px] z-[1]' : 'left-1 right-1 border-t-2'}`} style={{ top: pos(t.z), height: 0 }} />
        ) : (
          <div key={t.id} title={`${t.label} · ${t.color === 'unsure' ? 'AI unsure' : t.color}`} data-tone={t.color} className={`absolute -translate-y-1/2 rounded-full ${FILL[t.color]} ${t.sel ? '-left-1 -right-1 h-[5px] z-[1]' : 'left-1 right-1 h-[2px]'}`} style={{ top: pos(t.z) }} />
        )))}
        <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-1.5 rounded-sm bg-white shadow" style={{ top: pos(z) }} />
      </div>
    </div>
  );
}