import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { base44 } from '@/api/base44Client';
import { engine } from '@/api/engine';
import CropView from '@/components/CropView';
import { fmt1, fmtDateTime } from '@/lib/data';
import { meanOf } from '@/lib/geometry';

export default function ResultDetail({ n, scan, base, onClose }) {
  const evQ = useQuery({ queryKey: ['events', n?.id], enabled: !!n, queryFn: async () => (await base44.entities.EditEvent.filter({ nodule: n.id }, { sort: 'edited_at', limit: 300 })).items });
  if (!n) return null;
  const ai = n.ai_draft || {};
  const finalC = n.key_contour_px || [], aiC = ai.contour || [];
  const shapes = [
    ...(aiC.length > 2 ? [{ poly: aiC, color: '#fb923c', dash: '4 3' }] : []),
    ...(finalC.length > 2 ? [{ poly: finalC, color: '#5eead4', width: 2 }] : []),
    ...(n.long_axis_px ? [{ line: n.long_axis_px, color: '#f0abfc' }] : []),
    ...(n.short_axis_px ? [{ line: n.short_axis_px, color: '#f0abfc', dash: '4 3' }] : []),
  ];
  const rows = [
    ['Lobe', ai.lobe, n.lobe], ['Type', ai.type, n.type], ['Slice #', ai.key_slice_number, n.slice_number],
    ['Long axis mm', fmt1(ai.long), fmt1(n.long_axis_mm)], ['Short axis mm', fmt1(ai.short), fmt1(n.short_axis_mm)],
    ['Mean diameter mm', fmt1(meanOf(ai.long, ai.short)), fmt1(n.mean_diameter_mm)],
    ['Volume mm³', ai.volume ?? '—', n.outline_confirmed ? Math.round(n.volume_mm3 ?? 0) : 'not recorded'],
    ['Outline', 'AI draft', n.outline_confirmed ? `confirmed by ${n.outline_confirmed_by_initials}` : 'not confirmed'],
    ['Match to prior', ai.match_label || '—', n.match_to_prior || '—'],
  ];
  return (
    <Dialog open={!!n} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader><DialogTitle className="text-base"><span className="font-mono">{scan?.patient_id} · {n.nodule_label}</span> <span className="text-slate-500 font-normal">{scan?.timepoint} · approved by {scan?.approved_by_initials}</span></DialogTitle></DialogHeader>
        <div className="grid grid-cols-[320px_1fr] gap-5">
          <div>
            <CropView className="w-full aspect-square rounded" src={engine.sliceUrl(base, n.engine_scan_id, 'lung', n.key_slice_z)} focus={finalC.length ? finalC : aiC.length ? aiC : n.long_axis_px || []} shapes={shapes} />
            <div className="flex gap-4 mt-2 text-[11px] text-slate-500"><span className="flex items-center gap-1"><i className="w-4 h-0.5 bg-teal-300 inline-block" />Final</span><span className="flex items-center gap-1"><i className="w-4 border-t border-dashed border-orange-400 inline-block" />AI original</span></div>
          </div>
          <div className="space-y-4 min-w-0">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="text-left font-medium py-1"></th><th className="text-left font-medium">AI</th><th className="text-left font-medium">Final</th></tr></thead>
              <tbody>{rows.map(([k, a, f]) => <tr key={k} className="border-t border-slate-100"><td className="py-1.5 text-slate-500 text-xs">{k}</td><td className="font-mono text-xs">{a ?? '—'}</td><td className={`font-mono text-xs ${String(a ?? '—') !== String(f ?? '—') ? 'text-violet-700 font-medium' : ''}`}>{f ?? '—'}</td></tr>)}</tbody>
            </table>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Edit history</div>
              <div className="max-h-60 overflow-y-auto border border-slate-100 rounded">
                {(evQ.data || []).map((e) => (
                  <div key={e.id} className="px-3 py-1.5 border-b border-slate-50 text-xs flex gap-3">
                    <span className="font-mono text-slate-500 w-28 shrink-0">{fmtDateTime(e.edited_at)}</span>
                    <span className="font-mono w-8 shrink-0">{e.edited_by_initials}</span>
                    <span className="truncate"><b className="font-medium">{e.field}</b>{e.source ? ` (${e.source})` : ''}: <span className="font-mono">{e.old_value || '∅'} → {e.new_value || '∅'}</span>{e.ai_value ? <span className="text-slate-400"> · AI {e.ai_value}</span> : ''}</span>
                  </div>
                ))}
                {evQ.data && !evQ.data.length && <div className="px-3 py-3 text-xs text-slate-400">No edits — accepted as drafted.</div>}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}