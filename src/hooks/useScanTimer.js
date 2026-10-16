import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

// Two clocks per scan, both saved to the Scan every 15 s and when leaving:
// - active_seconds: only while Daniel is working (tab visible, input within idleSeconds).
// - total_seconds: time the scan is open in Review, from opening to approval, summed over visits
//   (closing the page stops it). Same idea as Daniel's "Minutes on scan" (whole process), but a scan left
//   open with no input (mouse, keys, scroll, touch) stops counting after TOTAL_IDLE_SECONDS and resumes
//   on the next input — so a forgotten open tab never ends up in the exported minutes.
export const TOTAL_IDLE_SECONDS = 300;

// Pure: seconds to credit to the total clock between lastTick and now, given the last input time.
// Time after lastInput + idle is not credited. Works with throttled timers (background tabs tick rarely).
export function creditTotal(lastTick, now, lastInput, idleSeconds = TOTAL_IDLE_SECONDS) {
  const until = Math.min(now, lastInput + idleSeconds * 1000);
  return Math.max(0, until - lastTick);
}

export function useScanTimer({ scanId, initial, initialTotal, enabled, idleSeconds }) {
  const [secs, setSecs] = useState(0);
  const [total, setTotal] = useState(0);
  const [paused, setPaused] = useState(false);
  const [totalPaused, setTotalPaused] = useState(false);
  const secsRef = useRef(0), savedRef = useRef(0), lastAct = useRef(Date.now()), loaded = useRef(null), enRef = useRef(enabled);
  const totalMs = useRef(0), lastTick = useRef(null), savedTotal = useRef(0);
  enRef.current = enabled;

  // Credit time since the last tick (only while running), then report whole seconds.
  const tick = () => {
    const now = Date.now();
    if (lastTick.current != null) totalMs.current += creditTotal(lastTick.current, now, lastAct.current);
    lastTick.current = enRef.current ? now : null;
  };
  const totalNow = () => { tick(); return Math.floor(totalMs.current / 1000); };

  useEffect(() => {
    if (scanId && loaded.current !== scanId && initial !== undefined) {
      loaded.current = scanId;
      secsRef.current = savedRef.current = initial || 0;
      totalMs.current = (initialTotal || 0) * 1000; savedTotal.current = initialTotal || 0;
      lastTick.current = null;
      setSecs(initial || 0); setTotal(initialTotal || 0);
    }
  }, [scanId, initial, initialTotal]);

  // The total clock runs while the scan is open and not approved (opening counts as input).
  useEffect(() => {
    if (enabled && loaded.current === scanId && lastTick.current == null) { lastAct.current = Date.now(); lastTick.current = Date.now(); }
    if (!enabled && lastTick.current != null) { tick(); lastTick.current = null; }
  }, [enabled, scanId, initial]);

  const save = useCallback(() => {
    if (!scanId || loaded.current !== scanId) return;
    const t = totalNow();
    if (secsRef.current === savedRef.current && t === savedTotal.current) return;
    savedRef.current = secsRef.current; savedTotal.current = t;
    base44.entities.Scan.update(scanId, { active_seconds: secsRef.current, total_seconds: t });
  }, [scanId]);

  useEffect(() => {
    // Before recording new input, credit the gap up to the idle cut-off (so a long gap isn't counted).
    const bump = () => { tick(); lastAct.current = Date.now(); };
    const evs = ['mousemove', 'mousedown', 'keydown', 'wheel', 'pointerdown', 'touchstart', 'scroll'];
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true, capture: true }));
    const vis = () => (document.hidden ? save() : bump());
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('beforeunload', save);
    return () => {
      evs.forEach((e) => window.removeEventListener(e, bump, { capture: true }));
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('beforeunload', save);
      save();
    };
  }, [save]);

  useEffect(() => {
    if (!enabled) return undefined;
    const t = setInterval(() => {
      setTotal(totalNow());
      setTotalPaused(Date.now() - lastAct.current >= TOTAL_IDLE_SECONDS * 1000);
      const active = !document.hidden && Date.now() - lastAct.current < idleSeconds * 1000;
      setPaused(!active);
      if (active) { secsRef.current += 1; setSecs(secsRef.current); }
      if (secsRef.current - savedRef.current >= 15 || totalNow() - savedTotal.current >= 15) save();
    }, 1000);
    return () => clearInterval(t);
  }, [enabled, idleSeconds, save]);

  // Pilot / mistakes: start this scan's clocks from zero (saved at once).
  const reset = () => {
    secsRef.current = savedRef.current = 0; totalMs.current = 0; savedTotal.current = 0;
    lastAct.current = Date.now(); lastTick.current = enRef.current ? Date.now() : null;
    setSecs(0); setTotal(0); setPaused(false); setTotalPaused(false);
    if (scanId) return base44.entities.Scan.update(scanId, { active_seconds: 0, total_seconds: 0, first_opened_at: new Date().toISOString() });
    return Promise.resolve();
  };

  return { secs, total, paused, totalPaused, reset, save, getSecs: () => secsRef.current, getTotal: totalNow };
}
