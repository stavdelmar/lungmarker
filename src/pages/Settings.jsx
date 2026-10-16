import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { engine } from '@/api/engine';
import { useSettings } from '@/hooks/useAppData';
import { useMe } from '@/hooks/useMe';
import EngineOffline from '@/components/EngineOffline';
import UserRoles from '@/components/settings/UserRoles';

const input = 'mt-1 w-full h-9 px-2.5 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:border-teal-600';

export default function Settings() {
  const me = useMe();
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const [f, setF] = useState(null);
  const [test, setTest] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (settings) setF(settings); }, [settings]);

  if (!me.loading && !me.isAdmin) return <div className="p-8 text-sm text-slate-500">Settings are available to admins only.</div>;
  if (!f) return <div className="flex-1 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;

  const runTest = async () => {
    setTest({ loading: true });
    try { setTest({ ok: await engine.health(f.engine_base_url) }); } catch (e) { setTest({ err: e.message }); }
  };
  const save = async () => {
    setSaving(true);
    const data = { engine_base_url: f.engine_base_url.trim(), baseline_minutes_baseline: Number(f.baseline_minutes_baseline), baseline_minutes_followup: Number(f.baseline_minutes_followup), idle_pause_seconds: Number(f.idle_pause_seconds) };
    if (settings.id) await base44.entities.AppSettings.update(settings.id, data); else await base44.entities.AppSettings.create(data);
    await qc.invalidateQueries({ queryKey: ['settings'] });
    setSaving(false);
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="px-8 py-6 max-w-[900px] w-full mx-auto space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <label className="block text-sm">Engine base URL
          <div className="flex gap-2"><input className={`${input} font-mono`} value={f.engine_base_url || ''} onChange={set('engine_base_url')} placeholder="https://…/api/v1" />
            <button onClick={runTest} className="mt-1 h-9 px-3 rounded-md border border-slate-300 text-sm whitespace-nowrap hover:bg-slate-50">Test connection</button></div>
        </label>
        {test?.loading && <div className="text-xs text-slate-500">Testing…</div>}
        {test?.err && <EngineOffline message={test.err} onRetry={runTest} />}
        {test?.ok && <div className="text-xs font-mono px-3 py-2 rounded bg-emerald-50 text-emerald-800">status {test.ok.status} · engine {test.ok.engine_version} · mode {test.ok.mode} · refine {test.ok.refine_available ? 'available' : 'not available'}</div>}
        <div className="grid grid-cols-3 gap-4">
          <label className="text-sm">Previous avg minutes (Baseline)<input type="number" className={`${input} font-mono`} value={f.baseline_minutes_baseline} onChange={set('baseline_minutes_baseline')} /></label>
          <label className="text-sm">Previous avg minutes (Follow-up)<input type="number" className={`${input} font-mono`} value={f.baseline_minutes_followup} onChange={set('baseline_minutes_followup')} /></label>
          <label className="text-sm">Idle pause (seconds)<input type="number" className={`${input} font-mono`} value={f.idle_pause_seconds} onChange={set('idle_pause_seconds')} /></label>
        </div>
        <button onClick={save} disabled={saving} className="h-9 px-4 rounded-md bg-slate-900 text-white text-sm hover:bg-slate-800 disabled:opacity-60">{saving ? 'Saving…' : 'Save settings'}</button>
      </section>
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Users</h2>
        <UserRoles />
      </section>
    </div>
  );
}