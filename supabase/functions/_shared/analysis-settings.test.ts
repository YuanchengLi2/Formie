import {
  ANALYST_THINKING_LEVEL,
  MAX_ANALYSIS_VIDEO_DURATION_MS,
  MIN_ANALYSIS_VIDEO_DURATION_MS,
  REQUESTED_ANALYSIS_FPS,
  REQUESTED_ANALYSIS_MEDIA_RESOLUTION,
  WRITER_THINKING_LEVEL,
} from "./analysis-settings";

describe("whole-video analysis settings", () => {
  it("keeps the supported input window at three to fifteen seconds", () => {
    expect(MIN_ANALYSIS_VIDEO_DURATION_MS).toBe(3_000);
    expect(MAX_ANALYSIS_VIDEO_DURATION_MS).toBe(15_000);
  });

  it("keeps high reasoning for video facts and uses fast reasoning for the time-bounded prose writer", () => {
    expect(REQUESTED_ANALYSIS_FPS).toBe(8);
    expect(REQUESTED_ANALYSIS_MEDIA_RESOLUTION).toBe("MEDIA_RESOLUTION_HIGH");
    expect(ANALYST_THINKING_LEVEL).toBe("high");
    expect(WRITER_THINKING_LEVEL).toBe("low");
  });
});
