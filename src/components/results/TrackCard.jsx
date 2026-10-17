import CropView from '@/components/CropView';
import { engine } from '@/api/engine';
import { fmt1 } from '@/lib/data';
import { volumeOf } from '@/lib/patientTracks';
import { boxOf } from '@/components/review/viewerUtils';

// Expert inter-reader measurement noise.
const NOISE_LONG_MM = 2.3, NOISE_VOL_PCT = 17;
const sgn = (v, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(d)}`;
const tpShort = (t) => (t === 'Baseline' ? 'Baseline' : t.replace('Follow-up ', 'FU '));

function Delta({ label, c, unit, digits }) {
  if (!c || c.abs == null) return <span className="text-slate-400">{label}: —</span>;
  return <span>{label}: <span className="font-mono">{sgn(c.abs, digits)} {unit}</span>{c.pct != null && <span className="font-mono text-slate-500"> ({sgn(c.pct)}%)</span>}</span>;
}

// One nodule followed over time: key-slice crops at the same zoom, sizes under each, then the change.
export default function TrackCard({ track: t, timepoints, base }) {
  const boxes = t.cells.map((n) => n && boxOf(n)).filter(Boolean);
  const half = boxes.length ? Math.max(...boxes.map((b) => Math.max(b[2] - b[0], b[3] - b[1]))) / 2 + 20 : undefined;
  const beyond = (t.long?.abs != null && Math.abs(t.long.abs) > NOISE_LONG_MM) || (t.volume?.pct != null && Math.abs(t.volume.pct) > NOISE_VOL_PCT);
  const comparable = timepoints.length > 1 && t.notFoundAt == null && t.newAt == null;
  return (
    <div className={`border rounded-lg p-3 ${comparable && beyond ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-baseline gap-2 mb-2 text-sm">
        <span className="font-mono font-medium">{t.labels.join(' → ')}</span>
        <span className="text-xs text-slate-500">{t.lobe || '—'}</span>
        {t.newAt != null && <span className="text-[11px] text-teal-800 bg-teal-50 rounded px-1.5">new on {tpShort(timepoints[t.newAt].timepoint)}</span>}
        {t.notFoundAt != null && <span className="text-[11px] text-amber-800 bg-amber-50 rounded px-1.5">not found on {tpShort(timepoints[t.notFoundAt].timepoint)}</span>}
      </div>
      <div className="flex gap-3 overflow-x-auto">
        {timepoints.map((s, j) => {
          const n = t.cells[j];
          const v = n && volumeOf(n);
          const focus = n?.key_contour_px?.length ? n.key_contour_px : n?.long_axis_px || [];
          const shapes = n?.outline_confirmed && n.key_contour_px?.length ? [{ poly: n.key_contour_px, color: '#5eead4' }] : [];
          return (
            <div key={s.id} className="w-36 shrink-0 text-xs">
              <div className="text-slate-500 mb-1 whitespace-nowrap">{tpShort(s.timepoint)}{n && <span className="font-mono"> · {n.nodule_label}</span>}</div>
              {n && n.key_slice_z != null
                ? <CropView className="w-36 aspect-square rounded" src={engine.sliceUrl(base, s.engine_scan_id, 'lung', n.key_slice_z)} focus={focus} shapes={shapes} half={half} />
                : <div className="w-36 aspect-square rounded bg-slate-100 grid place-items-center text-slate-400">{t.notFoundAt === j ? 'not found' : 'no finding'}</div>}
              {n && <div className="mt-1 font-mono">{fmt1(n.long_axis_mm)} mm · {v == null ? <span className="font-sans text-slate-400">outline not confirmed</span> : `${Math.round(v)} mm³`}</div>}
            </div>
          );
        })}
      </div>
      {comparable && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <Delta label="Long axis" c={t.long} unit="mm" digits={1} />
          {t.volumeMissing ? <span className="text-slate-400">Volume: outline not confirmed</span> : <Delta label="Volume" c={t.volume} unit="mm³" digits={0} />}
          <span className={`ml-auto px-2 py-0.5 rounded font-medium whitespace-nowrap ${beyond ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'}`}>
            {beyond ? 'Change beyond measurement noise' : 'Within measurement noise'}
          </span>
        </div>
      )}
    </div>
  );
}