import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const REASONS = ['Vessel', 'Scar/artefact', 'Under 4 mm', 'Duplicate', 'Other'];

export default function RejectDialog({ open, onOpenChange, label, onReject }) {
  const [reason, setReason] = useState('Vessel');
  const [other, setOther] = useState('');
  const submit = () => { onReject(reason === 'Other' ? `Other: ${other.trim()}` : reason); onOpenChange(false); setOther(''); };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="text-base">Reject {label}</DialogTitle></DialogHeader>
        <div className="space-y-1.5">
          {REASONS.map((r) => (
            <label key={r} className={`flex items-center gap-2 px-3 py-2 rounded border text-sm cursor-pointer ${reason === r ? 'border-slate-900 bg-slate-50' : 'border-slate-200'}`}>
              <input type="radio" checked={reason === r} onChange={() => setReason(r)} className="accent-slate-900" /> {r}
            </label>
          ))}
          {reason === 'Other' && <input autoFocus value={other} onChange={(e) => setOther(e.target.value)} placeholder="Reason" className="w-full h-9 px-2 rounded border border-slate-200 text-sm" />}
        </div>
        <button onClick={submit} disabled={reason === 'Other' && !other.trim()} className="mt-2 h-9 rounded-md bg-rose-600 text-white text-sm hover:bg-rose-700 disabled:opacity-50">Reject nodule</button>
      </DialogContent>
    </Dialog>
  );
}