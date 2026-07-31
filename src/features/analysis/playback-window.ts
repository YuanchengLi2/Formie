export type PlaybackWindow = {
  sourceStartMs: number;
  sourceEndMs: number;
};

export function resolvePlaybackWindow(
  sourceDurationMs: number,
  candidate: PlaybackWindow | null | undefined,
): PlaybackWindow {
  if (
    candidate
    && Number.isInteger(candidate.sourceStartMs)
    && Number.isInteger(candidate.sourceEndMs)
    && candidate.sourceStartMs >= 0
    && candidate.sourceEndMs > candidate.sourceStartMs
    && candidate.sourceEndMs <= sourceDurationMs
  ) {
    return candidate;
  }
  return { sourceStartMs: 0, sourceEndMs: Math.max(0, sourceDurationMs) };
}

export function clipDurationMs(window: PlaybackWindow): number {
  return Math.max(0, window.sourceEndMs - window.sourceStartMs);
}

export function sourceToClipMs(sourceMs: number, window: PlaybackWindow): number {
  return Math.min(clipDurationMs(window), Math.max(0, sourceMs - window.sourceStartMs));
}

export function clipToSourceMs(clipMs: number, window: PlaybackWindow): number {
  return Math.min(window.sourceEndMs, Math.max(window.sourceStartMs, window.sourceStartMs + clipMs));
}
