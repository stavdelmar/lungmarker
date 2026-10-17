// Two clocks per scan (Daniel, 17 Oct): "Minutes on scan" = ACTIVE work only (no long breaks) — exported and used
// for the "vs before" comparison. Total = time the scan was open, opening → approval — kept on screen and in the
// Edit trail for transparency, always labelled "open".
// Scans approved before 17 Oct stored total in minutes_on_scan; active_minutes has been stored since 16 Oct, so
// both helpers read the explicit fields first.
const up = (s) => (s == null ? null : Math.ceil(s / 60));
export const minutesOnScan = (s) => (s?.active_minutes ?? up(s?.active_seconds) ?? null);
export const openMinutes = (s) => (s?.total_minutes ?? up(s?.total_seconds) ?? null);
