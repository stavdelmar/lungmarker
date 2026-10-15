import { useEffect, useState } from 'react';

const pts = (p) => p.map((q) => q.join(',')).join(' ');

// Slice image + vector overlay, cropped around `focus` points.
export default function CropView({ src, focus = [], shapes = [], className = '' }) {
  const [dim, setDim] = useState(null);
  useEffect(() => {
    setDim(null);
    const im = new window.Image();
    im.onload = () => setDim([im.naturalWidth, im.naturalHeight]);
    im.onerror = () => setDim('err');
    im.src = src;
  }, [src]);

  if (dim === 'err') return <div className={`grid place-items-center bg-neutral-900 text-neutral-400 text-xs ${className}`}>Image unavailable (AI engine offline)</div>;
  if (!dim) return <div className={`bg-neutral-900 animate-pulse ${className}`} />;

  let vb = `0 0 ${dim[0]} ${dim[1]}`;
  if (focus.length) {
    const xs = focus.map((p) => p[0]), ys = focus.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const half = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 + 40;
    vb = `${cx - half} ${cy - half} ${half * 2} ${half * 2}`;
  }
  return (
    <svg viewBox={vb} className={`bg-neutral-900 ${className}`} preserveAspectRatio="xMidYMid meet">
      <image href={src} x="0" y="0" width={dim[0]} height={dim[1]} />
      {shapes.map((s, i) =>
        s.line ? (
          <line key={i} x1={s.line[0][0]} y1={s.line[0][1]} x2={s.line[1][0]} y2={s.line[1][1]} stroke={s.color} strokeWidth={s.width || 1.5} strokeDasharray={s.dash} vectorEffect="non-scaling-stroke" />
        ) : (
          <polygon key={i} points={pts(s.poly)} fill="none" stroke={s.color} strokeWidth={s.width || 1.5} strokeDasharray={s.dash} vectorEffect="non-scaling-stroke" />
        )
      )}
    </svg>
  );
}