import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

// Two clocks per scan, both saved to the Scan every 15 s and when leaving:
// - active_seconds: only while Daniel is working (tab visible, input within idleSeconds).
// - total_seconds: wall-clock time the scan is open in Review, from opening to approval, summed over
//   visits (closing the page stops it). Same definition as Daniel's "Minutes on scan" (whole process).
export function useScanTimer({ scanId, initial, initialTotal, enabled, idleSeconds }) {
  const [secs, setSecs] = useState(0);
  const [total, setTotal] = useState(0);
  const [paused, setPaused] = useState(false);
  const secsRef = useRef(0), savedRef = useRef(0), lastAct = useRef(Date.now()), loaded = useRef(null), enRef = useRef(enabled);
  const totalBase = useRef(0), sessionStart = useRef(null), savedTotal = useRef(0);
  enRef.current = enabled;

  const totalNow = () => totalBase.current + (sessionStart.current ? Math.floor((Date.now() - sessionStart.current) / 1000) : 0);

  useEffect(() => {
    if (scanId && loaded.current !== scanId && initial !== undefined) {
      loaded.current = scanId;
      secsRef.current = savedRef.current = initial || 0;
      totalBase.current = savedTotal.current = initialTotal || 0;
      sessionStart.current = null;
      setSecs(initial || 0); setTotal(initialTotal || 0);
    }
  }, [scanId, initial, initialTotal]);

  // The total clock runs while the scan is open and not approved.
  useEffect(() => {
    if (enabled && loaded.current === scanId && !sessionStart.current) sessionStart.current = Date.now();
    if (!enabled && sessionStart.current) { totalBase.current = totalNow(); sessionStart.current = null; }
  }, [enabled, scanId, initial]);

  const save = useCallback(() => {
    if (!scanId || loaded.current !== scanId) return;
    const t = totalNow();
    if (secsRef.current === savedRef.current && t === savedTotal.current) return;
    if (!enRef.current && !sessionStart.current && t === savedTotal.current && secsRef.current === savedRef.current) return;
    savedRef.current = secsRef.current; savedTotal.current = t;
    base44.entities.Scan.update(scanId, { active_seconds: secsRef.current, total_seconds: t });
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
    if (!enabled) return undefined;
    const t = setInterval(() => {
      setTotal(totalNow());
      const active = !document.hidden && Date.now() - lastAct.current < idleSeconds * 1000;
      setPaused(!active);
      if (active) { secsRef.current += 1; setSecs(secsRef.current); }
      if (secsRef.current - savedRef.current >= 15 || totalNow() - savedTotal.current >= 15) save();
    }, 1000);
    return () => clearInterval(t);
  }, [enabled, idleSeconds, save]);

  return { secs, total, paused, getSecs: () => secsRef.current, getTotal: totalNow };
}
