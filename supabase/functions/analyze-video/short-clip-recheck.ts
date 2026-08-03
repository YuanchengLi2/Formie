export const MAX_SHORT_CLIP_RECHECKS = 3;
export const SHORT_CLIP_RECHECK_WINDOW_MS = 2_000;

export type ShortClipRecheckRequest = {
  centerMs: number;
  reason: string;
};

export type RecheckableAnalysis = {
  recheckRequest: ShortClipRecheckRequest | null;
};

export type ShortClipWindow = { startMs: number; endMs: number };

export function buildShortClipWindow(centerMs: number, durationMs: number): ShortClipWindow {
  if (!Number.isFinite(durationMs) || durationMs <= 0) throw new Error("durationMs must be positive");
  if (!Number.isFinite(centerMs) || centerMs < 0 || centerMs > durationMs) throw new Error("recheckRequest.centerMs must be within the recording");
  const lengthMs = Math.min(SHORT_CLIP_RECHECK_WINDOW_MS, durationMs);
  const idealStart = centerMs - lengthMs / 2;
  const startMs = Math.max(0, Math.min(idealStart, durationMs - lengthMs));
  return { startMs, endMs: startMs + lengthMs };
}

export async function runShortClipRechecks<T extends RecheckableAnalysis>(input: {
  initialAnalysis: T;
  durationMs: number;
  review: (input: {
    analysis: T;
    request: ShortClipRecheckRequest;
    window: ShortClipWindow;
    recheckNumber: number;
    remainingAfterThis: number;
  }) => Promise<T>;
}): Promise<{ analysis: T; recheckCount: number; limitReached: boolean }> {
  let analysis = input.initialAnalysis;
  let recheckCount = 0;
  while (analysis.recheckRequest && recheckCount < MAX_SHORT_CLIP_RECHECKS) {
    const request = analysis.recheckRequest;
    if (!request.reason.trim()) throw new Error("recheckRequest.reason must be a non-empty string");
    const window = buildShortClipWindow(request.centerMs, input.durationMs);
    const recheckNumber = recheckCount + 1;
    analysis = await input.review({
      analysis,
      request,
      window,
      recheckNumber,
      remainingAfterThis: MAX_SHORT_CLIP_RECHECKS - recheckNumber,
    });
    recheckCount = recheckNumber;
  }
  return {
    analysis,
    recheckCount,
    limitReached: recheckCount === MAX_SHORT_CLIP_RECHECKS && analysis.recheckRequest !== null,
  };
}
