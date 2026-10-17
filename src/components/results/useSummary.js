import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchAll } from '@/lib/data';
import { exportable } from '@/lib/exportRows';
import { reviewBreakdown, patientTracks, noduleCounts } from '@/lib/patientTracks';

const { Nodule } = base44.entities;

// Nodule counts and the AI-findings breakdown for the approved scans (shared by the top cards and Performance).
export function useSummary(scans) {
  const scanIds = scans.map((s) => s.id);
  return useQuery({
    queryKey: ['resultsSummary', scanIds.join(',')],
    enabled: scanIds.length > 0,
    queryFn: async () => {
      const all = await fetchAll(Nodule, { scan: { $in: scanIds } }, 'nodule_label');
      const counts = noduleCounts(patientTracks(scans, all).flatMap((p) => p.tracks));
      return { ...reviewBreakdown(all.filter((n) => n.status !== 'Accepted' || exportable(n))), counts };
    },
  });
}