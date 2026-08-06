export function countdownSequence(seconds: number): number[] {
  if (!Number.isInteger(seconds) || seconds < 0) throw new Error("Countdown seconds must be a non-negative integer");
  return Array.from({ length: seconds + 1 }, (_, index) => seconds - index);
}

export function formatElapsed(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function normalizeRecordedDuration(durationMs: number): number {
  return Math.max(0, Math.round(durationMs));
}

export function recordedDurationFromCapture(input: {
  startedAtMs: number;
  resolvedAtMs: number;
  requestedStopAtMs: number | null;
  maxDurationMs: number;
}): number {
  const resolvedDurationMs = normalizeRecordedDuration(input.resolvedAtMs - input.startedAtMs);
  if (input.requestedStopAtMs !== null) {
    return normalizeRecordedDuration(input.requestedStopAtMs - input.startedAtMs);
  }
  return resolvedDurationMs >= input.maxDurationMs ? input.maxDurationMs : resolvedDurationMs;
}
