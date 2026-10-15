import { useEffect, useState } from 'react';
import NumField from '@/components/review/NumField';
import SelectField from '@/components/review/SelectField';
import OutlineActions from '@/components/review/OutlineActions';
import { fmtMaybe } from '@/components/review/viewerUtils';

const LOBES = ['RUL', 'RML', 'RLL', 'LUL', 'LLL'];
const TYPES = ['Solid', 'Part-solid', 'Ground-glass'];

export default function NoduleForm({ n, locked, followup, priorLabels, aiSuggest, onSave, outline }) {
  const [notes, setNotes] = useState(n.notes || '');
  useEffect(() => setNotes(n.notes || ''), [n.id, n.notes]);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2.5">
        <SelectField label="Lobe" value={n.lobe} options={LOBES} disabled={locked} onChange={(v) => onSave({ lobe: v })} />
        <SelectField label="Type" value={n.type} options={TYPES} disabled={locked} onChange={(v) => onSave({ type: v })} />
        <label className="block"><span className="text-[11px] text-slate-500">Slice # (key slice)</span>
          <div className="mt-0.5 h-8 px-2 flex items-center rounded bg-slate-50 border border-slate-100 font-mono text-sm">{n.slice_number ?? '—'}</div></label>
        <NumField label="Long axis mm" value={n.long_axis_mm} disabled={locked} onCommit={(v) => onSave({ long_axis_mm: v })} />
        <NumField label="Short axis mm" value={n.short_axis_mm} disabled={locked} onCommit={(v) => onSave({ short_axis_mm: v })} />
        <label className="block"><span className="text-[11px] text-slate-500">Mean diameter mm</span>
          <div className="mt-0.5 h-8 px-2 flex items-center rounded bg-slate-50 border border-slate-100 font-mono text-sm">{fmtMaybe(n.mean_diameter_mm)}</div></label>
        {n.type === 'Part-solid' && <NumField label="Solid component mm" value={n.solid_component_mm} disabled={locked} onCommit={(v) => onSave({ solid_component_mm: v })} />}
        <div className="col-span-2">
          <NumField label="Volume mm³" value={n.volume_mm3} disabled={locked} round={Math.round} muted={!n.outline_confirmed} onCommit={(v) => onSave({ volume_mm3: v })}
            hint={n.volume_stale ? 'Outline edited by hand – volume not recomputed yet (not exported)' : n.outline_confirmed ? `confirmed by ${n.outline_confirmed_by_initials}` : 'AI estimate – confirm outline to record'} />
        </div>
      </div>
      <OutlineActions n={n} locked={locked} {...outline} />
      {followup && (
        <div className="rounded-md border border-slate-200 p-2.5 bg-slate-50/60">
          <SelectField label="Match to prior" value={n.match_to_prior} disabled={locked} placeholder="Not recorded"
            options={[...priorLabels, { value: 'N/A', label: 'N/A (new nodule)' }]} onChange={(v) => onSave({ match_to_prior: v })} />
          {aiSuggest && (
            <div className="flex items-center justify-between mt-1.5 text-[11.5px] text-slate-600">
              <span>AI suggests <b className="font-mono">{aiSuggest.label}</b>{aiSuggest.conf != null && <>, confidence <span className="font-mono">{aiSuggest.conf}%</span></>}</span>
              {!locked && n.match_to_prior !== aiSuggest.label && <button onClick={() => onSave({ match_to_prior: aiSuggest.label })} className="text-teal-700 hover:underline">Use suggestion</button>}
            </div>
          )}
        </div>
      )}
      <label className="block"><span className="text-[11px] text-slate-500">Notes</span>
        <textarea rows={2} value={notes} disabled={locked} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (n.notes || '') && onSave({ notes })}
          className="mt-0.5 w-full px-2 py-1.5 rounded border border-slate-200 text-sm focus:outline-none focus:border-teal-600 disabled:bg-slate-50" /></label>
    </div>
  );
}