// Has everything the Review page needs arrived? (Stav, 18 Oct: on opening, the page briefly showed "NODULES (0)",
// "The AI found no nodules", "prior N1, N2 not matched" and slice #1 — all drawn from data that hadn't loaded yet.)
// Until 'ready', the page shows a loading state, no empty-state text, no Approve warnings, and the timer doesn't run.
//
// 'loading' | 'ready' | 'error' (engine unreachable before this scan's AI draft could be copied in).
// Once a scan has been 'ready', it stays ready (pass wasReady): the background refetches after every save must not
// flash the loading state again.
export function reviewLoadState({
  wasReady = false, scan, isReviewer, nodules, nodulesFetching, meta, findings, engineError,
  patientScans, priorId, prior, waitForPrior,
}) {
  if (wasReady) return 'ready';
  if (!scan) return 'loading';
  const notStarted = scan.review_status === 'Not started';
  // The prior link can come from the patient's scans (previous timepoint), so they must be in before the prior.
  if (!patientScans) return 'loading';
  if (priorId && !prior) return 'loading';
  // Follow-up waiting for its prior's approval: the panel shows that card on purpose (nothing more to load).
  if (waitForPrior) return 'ready';
  if (engineError) return notStarted && isReviewer ? 'error' : nodules && !nodulesFetching ? 'ready' : 'loading';
  if (!meta || !findings) return 'loading';
  // First opening: the AI draft is copied into Base44 now (setupScan); until then the list is empty, not "no nodules".
  if (notStarted && isReviewer) return 'loading';
  // The first fetch after setup must be done: a list fetched before setup is stale (empty).
  if (!nodules || nodulesFetching) return 'loading';
  return 'ready';
}

// Where the page opens once loaded: the first nodule's key slice; with no nodules, the middle of the scan
// (never slice #1, which is the top of the scan — the neck).
export function openingSlice(nodules, nSlices) {
  const withKey = (nodules || []).filter((n) => n.kind !== 'prior_not_found' && n.key_slice_z != null);
  if (withKey.length) return withKey[0].key_slice_z;
  return Math.max(0, Math.floor(((nSlices || 1) - 1) / 2));
}
