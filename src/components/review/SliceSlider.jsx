import { useRef } from 'react';

export default function SliceSlider({ z, n, ticks, onChange }) {
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
        {ticks.map((t) => (
          <div key={t.id} title={t.label} className={`absolute left-0.5 right-0.5 h-[3px] -translate-y-1/2 rounded-full ${t.sel ? 'bg-teal-300' : 'bg-amber-400/80'}`} style={{ top: pos(t.z) }} />
        ))}
        <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-1.5 rounded-sm bg-white shadow" style={{ top: pos(z) }} />
      </div>
    </div>
  );
}