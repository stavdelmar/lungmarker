import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function initialsFrom(name = '') {
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 3).toUpperCase();
}

export function useMe() {
  const q = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me(), staleTime: 60000 });
  const user = q.data;
  return {
    user,
    loading: q.isLoading,
    isReviewer: user?.app_role === 'reviewer',
    isAdmin: user?.role === 'admin',
    initials: user?.initials || initialsFrom(user?.full_name || user?.email || ''),
  };
}