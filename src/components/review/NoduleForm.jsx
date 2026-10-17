import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import NumField from '@/components/review/NumField';
import SelectField from '@/components/review/SelectField';
import { fmtMaybe } from '@/components/review/viewerUtils';

const LOBES = ['RUL', 'RML', 'RLL', 'LUL', 'LLL'];
const TYPES = ['Solid', 'Part-solid', 'Ground-glass'];
const ro = 'mt-0.5 h-8 px-2 flex items-center rounded bg-slate-50 border border-slate-100 font-mono text-sm';

// Step 3: the volume and the one primary action for it, "Confirm outline". Axes and volume follow every outline
// edit (Erase, Draw, dragged points) by themselves; confirming records the volume for the sheet.
export function VolumeConfirm({ n, locked, onSave, onConfirm }) {
  const hasOutline = (n.key_contour_px || []).length > 2 || Object.keys(n.contour_edits || {}).length > 0;
  return (
    <div className={`rounded-lg border p-3 ${n.outline_confirmed ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200'}`}>
      <NumField label="Volume mm³" value={n.volume_mm3} digits={0} disabled={locked} muted={!n.outline_confirmed} onCommit={(v) => onSave({ volume_mm3: v })}
        hint={n.outline_confirmed ? `Outline confirmed by ${n.outline_confirmed_by_initials} · volume recorded` : n.volume_mm3 == null ? 'No volume yet (needs an outline)' : 'AI estimate: confirm the outline to record it'}
        right={n.outline_confirmed ? (
          <span className="h-8 px-3 shrink-0 rounded-md bg-emerald-100 text-emerald-800 text-sm font-medium flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" />Confirmed</span>
        ) : !locked && (
          <button type="button" onClick={onConfirm} disabled={!hasOutline} className="h-8 px-3 shrink-0 rounded-md bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-40 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />Confirm outline
          </button>
        )} />
    </div>
  );
}

export function Measurements({ n, locked, onSave }) {
  const needLobe = n.status === 'Accepted' && !n.lobe, needType = n.status === 'Accepted' && !n.type;
  return (
    <div className="grid grid-cols-3 gap-2.5">
      <div className={needLobe ? 'rounded ring-2 ring-amber-400' : ''}><SelectField label={needLobe ? 'Lobe · required' : 'Lobe'} value={n.lobe} options={LOBES} disabled={locked} onChange={(v) => onSave({ lobe: v })} /></div>
      <div className={needType ? 'rounded ring-2 ring-amber-400' : ''}><SelectField label={needType ? 'Type · required' : 'Type'} value={n.type} options={TYPES} disabled={locked} onChange={(v) => onSave({ type: v })} /></div>
      <label className="block"><span className="text-[11px] text-slate-500">Slice # (key slice)</span><div className={ro}>{n.slice_number ?? '—'}</div></label>
      <NumField label="Long axis mm" value={n.long_axis_mm} disabled={locked} onCommit={(v) => onSave({ long_axis_mm: v })} />
      <NumField label="Short axis mm" value={n.short_axis_mm} disabled={locked} onCommit={(v) => onSave({ short_axis_mm: v })} />
      <label className="block"><span className="text-[11px] text-slate-500">Mean diameter mm</span><div className={ro}>{fmtMaybe(n.mean_diameter_mm)}</div></label>
      {n.type === 'Part-solid' && <NumField label="Solid component mm" value={n.solid_component_mm} disabled={locked} onCommit={(v) => onSave({ solid_component_mm: v })} />}
    </div>
  );
}

export function Notes({ n, locked, onSave }) {
  const [notes, setNotes] = useState(n.notes || '');
  useEffect(() => setNotes(n.notes || ''), [n.id, n.notes]);
  return (
    <label className="block"><span className="text-[11px] text-slate-500">Notes</span>
      <textarea rows={2} value={notes} disabled={locked} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (n.notes || '') && onSave({ notes })}
        className="mt-0.5 w-full px-2 py-1.5 rounded border border-slate-200 text-sm focus:outline-none focus:border-teal-600 disabled:bg-slate-50" /></label>
  );
}
