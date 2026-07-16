export function evidencePreviewMs(moment: { startMs: number; peakMs?: number; endMs: number }): number {
  if (moment.peakMs !== undefined && moment.peakMs >= moment.startMs && moment.peakMs <= moment.endMs) return moment.peakMs;
  return Math.round((moment.startMs + moment.endMs) / 2);
}

export function formatCoachingTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1_000));
  return `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, "0")}`;
}

export function formatPointAdvice(moment: { startMs: number; peakMs?: number; coachingNote?: string; visualEvidence: string }): string {
  const note = (moment.coachingNote?.trim() || moment.visualEvidence.trim()).replace(/^At\s+\d+:\d+(?:\.\d+)?\s*,?\s*/i, "");
  const sentence = note ? `${note.charAt(0).toLocaleLowerCase()}${note.slice(1)}` : "review this moment and repeat the movement with control.";
  return `At ${formatCoachingTime(moment.peakMs ?? moment.startMs)}, ${sentence}`;
}
