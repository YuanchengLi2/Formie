const terminalStatuses = new Set(["complete", "partial", "unable", "failed"]);

export function analysisRefetchInterval(
  status: string | undefined,
  analysisNextRetryAt: string | null | undefined,
  now = Date.now(),
): number | false {
  if (status && terminalStatuses.has(status)) return false;
  const retryAt = analysisNextRetryAt ? Date.parse(analysisNextRetryAt) : NaN;
  if (Number.isFinite(retryAt) && retryAt > now) {
    return Math.min(30_000, Math.max(1_000, retryAt - now));
  }
  return 750;
}
