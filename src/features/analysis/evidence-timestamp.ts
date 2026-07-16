export function evidencePreviewMs(moment: { startMs: number; peakMs?: number; endMs: number }): number {
  if (moment.peakMs !== undefined && moment.peakMs >= moment.startMs && moment.peakMs <= moment.endMs) return moment.peakMs;
  return Math.round((moment.startMs + moment.endMs) / 2);
}
