import {
  clipDurationMs,
  clipToSourceMs,
  resolvePlaybackWindow,
  sourceToClipMs,
} from "./playback-window";

describe("exercise playback window", () => {
  it("converts between source and exercise-only time", () => {
    const window = resolvePlaybackWindow(20_000, { sourceStartMs: 4_000, sourceEndMs: 17_500 });

    expect(window).toEqual({ sourceStartMs: 4_000, sourceEndMs: 17_500 });
    expect(clipDurationMs(window)).toBe(13_500);
    expect(sourceToClipMs(4_000, window)).toBe(0);
    expect(sourceToClipMs(16_500, window)).toBe(12_500);
    expect(clipToSourceMs(0, window)).toBe(4_000);
    expect(clipToSourceMs(13_500, window)).toBe(17_500);
  });

  it("clamps timestamps to the exercise interval", () => {
    const window = { sourceStartMs: 4_000, sourceEndMs: 17_500 };
    expect(sourceToClipMs(1_000, window)).toBe(0);
    expect(sourceToClipMs(19_000, window)).toBe(13_500);
    expect(clipToSourceMs(-1_000, window)).toBe(4_000);
    expect(clipToSourceMs(20_000, window)).toBe(17_500);
  });

  it("falls back to full-video playback for a missing or invalid legacy window", () => {
    expect(resolvePlaybackWindow(12_000, null)).toEqual({ sourceStartMs: 0, sourceEndMs: 12_000 });
    expect(resolvePlaybackWindow(12_000, { sourceStartMs: 8_000, sourceEndMs: 13_000 })).toEqual({ sourceStartMs: 0, sourceEndMs: 12_000 });
    expect(resolvePlaybackWindow(12_000, { sourceStartMs: 8_000, sourceEndMs: 8_000 })).toEqual({ sourceStartMs: 0, sourceEndMs: 12_000 });
  });
});
