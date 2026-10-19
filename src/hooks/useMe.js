import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { DEFAULT_ROLE, ensureRole, needsRole, storedRole } from '@/lib/role';

export { DEFAULT_ROLE };

export function initialsFrom(name = '') {
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 3).toUpperCase();
}

export function useMe() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me(), staleTime: 60000 });
  const user = q.data;
  const missing = needsRole(user);
  // No stored role → save the default once (shared by every component using useMe), then refetch `me`. Until the
  // refetched user carries the stored role, `loading` stays true, so nothing that writes (scan setup) starts early.
  const roleQ = useQuery({
    queryKey: ['ensureRole', user?.id], enabled: missing, retry: false, staleTime: Infinity,
    queryFn: async () => { const r = await ensureRole(base44.auth, user); await qc.invalidateQueries({ queryKey: ['me'] }); return r; },
  });
  return {
    user,
    loading: q.isLoading || (missing && !roleQ.isError),
    roleError: missing && roleQ.isError ? roleQ.error : null, // role couldn't be saved: the user stays read-only
    isReviewer: storedRole(user) === 'reviewer',
    isAdmin: user?.role === 'admin',
    initials: user?.initials || initialsFrom(user?.full_name || user?.email || ''),
  };
}
