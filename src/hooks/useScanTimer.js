import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

// Counts only active time; persists to Scan.active_seconds every 15 s and on leave.
export function useScanTimer({ scanId, initial, enabled, idleSeconds }) {
  const [secs, setSecs] = useState(0);
  const [paused, setPaused] = useState(false);
  const secsRef = useRef(0), savedRef = useRef(0), lastAct = useRef(Date.now()), loaded = useRef(null), enRef = useRef(enabled);
  enRef.current = enabled;

  useEffect(() => {
    if (scanId && loaded.current !== scanId && initial !== undefined) {
      loaded.current = scanId;
      secsRef.current = savedRef.current = initial || 0;
      setSecs(initial || 0);
    }
  }, [scanId, initial]);

  const save = useCallback(() => {
    if (!enRef.current || !scanId || secsRef.current === savedRef.current) return;
    savedRef.current = secsRef.current;
    base44.entities.Scan.update(scanId, { active_seconds: secsRef.current });
  }, [scanId]);

  useEffect(() => {
    const bump = () => { lastAct.current = Date.now(); };
    const evs = ['mousemove', 'mousedown', 'keydown', 'wheel'];
    evs.forEach((e) => window.addEventListener(e, bump));
    const vis = () => (document.hidden ? save() : bump());
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('beforeunload', save);
    return () => {
      evs.forEach((e) => window.removeEventListener(e, bump));
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('beforeunload', save);
      save();
    };
  }, [save]);

  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => {
      const active = !document.hidden && Date.now() - lastAct.current < idleSeconds * 1000;
      setPaused(!active);
      if (!active) return;
      secsRef.current += 1;
      setSecs(secsRef.current);
      if (secsRef.current - savedRef.current >= 15) save();
    }, 1000);
    return () => clearInterval(t);
  }, [enabled, idleSeconds, save]);

  return { secs, paused, getSecs: () => secsRef.current };
}