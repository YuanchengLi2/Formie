import {
  ANALYSIS_RUNTIME_CONTRACT,
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
    expect(REQUESTED_ANALYSIS_FPS).toBe(12);
    expect(REQUESTED_ANALYSIS_MEDIA_RESOLUTION).toBe("MEDIA_RESOLUTION_HIGH");
    expect(ANALYST_THINKING_LEVEL).toBe("high");
    expect(WRITER_THINKING_LEVEL).toBe("low");
  });

  it("exposes one immutable versioned contract for request construction and telemetry", () => {
    expect(Object.isFrozen(ANALYSIS_RUNTIME_CONTRACT)).toBe(true);
    expect(ANALYSIS_RUNTIME_CONTRACT).toEqual({
      pipelineVersion: "gemini-whole-video-v88-evidence-scoring",
      analystModel: "gemini-3.7-flash",
      analystThinkingLevel: "high",
      mediaResolution: "MEDIA_RESOLUTION_HIGH",
      requestedFps: 12,
      writerModel: "gemini-3.1-flash-lite",
      writerThinkingLevel: "low",
      requestedIssueScope: "4-6-highest-consequence",
    });
  });
});
