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
// Both clocks over the same interval, in ms (bug 17 Oct: active was counted +1 per 1-s tick while open was measured
// and rounded down, so the header could show "2:02 active · 2:01 open"). Active = the part of the interval with
// the tab visible and input within idleActive seconds; it can never exceed the open time of the same interval.
export function creditBoth(lastTick, now, lastInput, { idleActive, hidden }) {
  const total = creditTotal(lastTick, now, lastInput, TOTAL_IDLE_SECONDS);
  const active = hidden ? 0 : Math.min(total, creditTotal(lastTick, now, lastInput, idleActive));
  return { total, active };
}

export function useScanTimer({ scanId, initial, initialTotal, enabled, idleSeconds }) {
  const [secs, setSecs] = useState(0);
  const [total, setTotal] = useState(0);
  const [paused, setPaused] = useState(false);
  const [totalPaused, setTotalPaused] = useState(false);
  const secsRef = useRef(0), savedRef = useRef(0), lastAct = useRef(Date.now()), loaded = useRef(null), enRef = useRef(enabled);
  const totalMs = useRef(0), activeMs = useRef(0), lastTick = useRef(null), savedTotal = useRef(0), idleRef = useRef(idleSeconds);
  enRef.current = enabled; idleRef.current = idleSeconds || 120;

  // Credit time since the last tick (only while running), then report whole seconds.
  const tick = () => {
    const now = Date.now();
    if (lastTick.current != null) {
      const c = creditBoth(lastTick.current, now, lastAct.current, { idleActive: idleRef.current, hidden: document.hidden });
      totalMs.current += c.total; activeMs.current += c.active;
      if (activeMs.current > totalMs.current) activeMs.current = totalMs.current; // invariant, also for restored values
      secsRef.current = Math.floor(activeMs.current / 1000);
    }
    lastTick.current = enRef.current ? now : null;
  };
  const totalNow = () => { tick(); return Math.floor(totalMs.current / 1000); };

  useEffect(() => {
    if (scanId && loaded.current !== scanId && initial !== undefined) {
      loaded.current = scanId;
      // Saved values from before this fix could have active > total; the open time is the ceiling.
      const tot = initialTotal || 0, act = Math.min(initial || 0, Math.max(tot, initialTotal == null ? (initial || 0) : 0));
      secsRef.current = savedRef.current = act; activeMs.current = act * 1000;
      totalMs.current = Math.max(tot, act) * 1000; savedTotal.current = Math.max(tot, act);
      lastTick.current = null;
      setSecs(act); setTotal(Math.max(tot, act));
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
      setTotal(totalNow()); // also credits the active clock (same interval)
      setSecs(secsRef.current);
      setTotalPaused(Date.now() - lastAct.current >= TOTAL_IDLE_SECONDS * 1000);
      setPaused(document.hidden || Date.now() - lastAct.current >= idleSeconds * 1000);
      if (secsRef.current - savedRef.current >= 15 || totalNow() - savedTotal.current >= 15) save();
    }, 1000);
    return () => clearInterval(t);
  }, [enabled, idleSeconds, save]);

  // Pilot / mistakes: start this scan's clocks from zero (saved at once).
  const reset = () => {
    secsRef.current = savedRef.current = 0; totalMs.current = 0; activeMs.current = 0; savedTotal.current = 0;
    lastAct.current = Date.now(); lastTick.current = enRef.current ? Date.now() : null;
    setSecs(0); setTotal(0); setPaused(false); setTotalPaused(false);
    if (scanId) return base44.entities.Scan.update(scanId, { active_seconds: 0, total_seconds: 0, first_opened_at: new Date().toISOString() });
    return Promise.resolve();
  };

  const getTotal = totalNow; // credits both clocks
  return { secs, total, paused, totalPaused, reset, save, getSecs: () => { totalNow(); return secsRef.current; }, getTotal };
}
