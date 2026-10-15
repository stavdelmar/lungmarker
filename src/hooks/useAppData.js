import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { engine } from '@/api/engine';

const DEFAULTS = { engine_base_url: '', baseline_minutes_baseline: 39, baseline_minutes_followup: 55, idle_pause_seconds: 120 };

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const page = await base44.entities.AppSettings.filter({}, { limit: 1, sort: 'created_date' });
      const s = page.items?.[0];
      const out = { ...DEFAULTS };
      if (s) Object.keys(s).forEach((k) => { if (s[k] != null) out[k] = s[k]; });
      return out;
    },
  });
}

export function useHealth(base) {
  return useQuery({ queryKey: ['health', base], enabled: !!base, retry: false, queryFn: () => engine.health(base) });
}