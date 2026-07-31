import { playbackWindowFromSession } from "./analysis-playback-window";

describe("playbackWindowFromSession", () => {
  it("returns the validated active-set interval from the saved analyst decision", () => {
    expect(playbackWindowFromSession({
      duration_ms: 20_000,
      analysis_draft: {
        wholeSetCoverage: { activeSetStartMs: 3_500, activeSetEndMs: 16_250 },
      },
    })).toEqual({ sourceStartMs: 3_500, sourceEndMs: 16_250 });
  });

  it("falls back to null for missing or invalid legacy coverage", () => {
    expect(playbackWindowFromSession({ duration_ms: 20_000, analysis_draft: null })).toBeNull();
    expect(playbackWindowFromSession({
      duration_ms: 20_000,
      analysis_draft: {
        wholeSetCoverage: { activeSetStartMs: 16_250, activeSetEndMs: 3_500 },
      },
    })).toBeNull();
    expect(playbackWindowFromSession({
      duration_ms: 20_000,
      analysis_draft: {
        wholeSetCoverage: { activeSetStartMs: 3_500, activeSetEndMs: 25_000 },
      },
    })).toBeNull();
  });
});
