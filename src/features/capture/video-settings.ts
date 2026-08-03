export const MIN_VIDEO_DURATION_MS = 3_000;
export const MAX_VIDEO_DURATION_MS = 15_000;

export const captureVideoSettings = {
  maxDurationSeconds: MAX_VIDEO_DURATION_MS / 1_000,
  quality: "720p" as const,
  bitrate: 2_750_000,
  minimumDurationMs: MIN_VIDEO_DURATION_MS,
  countdownSeconds: 10,
};
