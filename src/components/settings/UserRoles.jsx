import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchAll } from '@/lib/data';

export default function UserRoles() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['users'], queryFn: () => fetchAll(base44.entities.User, {}) }); // SDK pages ({ items }), like every other list in the app
  const update = async (u, patch) => { await base44.entities.User.update(u.id, patch); qc.invalidateQueries({ queryKey: ['users'] }); qc.invalidateQueries({ queryKey: ['me'] }); };
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
          <tr>{['Name', 'Email', 'Initials', 'Role'].map((h) => <th key={h} className="text-left font-medium px-4 py-2.5">{h}</th>)}</tr>
        </thead>
        <tbody>
          {(q.data || []).map((u) => (
            <tr key={u.id} className="border-t border-slate-100">
              <td className="px-4 py-2">{u.full_name || '—'}</td>
              <td className="px-4 text-slate-600">{u.email}</td>
              <td className="px-4"><input defaultValue={u.initials || ''} maxLength={4} onBlur={(e) => e.target.value.toUpperCase() !== (u.initials || '') && update(u, { initials: e.target.value.toUpperCase() })} className="w-16 h-7 px-2 rounded border border-slate-200 font-mono text-sm uppercase" /></td>
              <td className="px-4">
                {/* Only the stored role: the server's permission rules see nothing else. A new user gets "reviewer"
                    saved at their first sign-in (review period); until then the row says so instead of guessing. */}
                <select value={u.app_role || ''} onChange={(e) => e.target.value && update(u, { app_role: e.target.value })} className={`h-7 px-1.5 rounded border text-sm bg-white ${u.app_role ? 'border-slate-200' : 'border-amber-300 text-amber-800'}`}>
                  {!u.app_role && <option value="" disabled>no role saved</option>}
                  <option value="viewer">viewer</option><option value="reviewer">reviewer</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}