import { selectGeminiVideoPath } from "./analysis-input";

describe("Gemini analysis input selection", () => {
  it("uses the privacy-safe full-duration fallback only after the persisted variant switches", () => {
    expect(selectGeminiVideoPath({
      videoPath: "user/session/original.mp4",
      analysisVideoPath: "user/session/analysis-input.mp4",
      analysisFallbackVideoPath: "user/session/privacy-safe-upper-body.mp4",
      analysisInputStrategy: "upright_video",
      analysisInputVariant: "privacy_safe_upper_body",
    })).toBe("user/session/privacy-safe-upper-body.mp4");
  });

  it("uses the normalized full-length upright video when upload completion provided one", () => {
    expect(selectGeminiVideoPath({
      videoPath: "user/session/original.mp4",
      analysisVideoPath: "user/session/analysis-input.mp4",
      analysisInputStrategy: "upright_video",
    })).toBe("user/session/analysis-input.mp4");
  });

  it("uses the original video only for sessions with the direct video strategy", () => {
    expect(selectGeminiVideoPath({
      videoPath: "user/session/original.mp4",
      analysisVideoPath: null,
      analysisInputStrategy: "video",
    })).toBe("user/session/original.mp4");
  });

  it("rejects an upright session whose normalized upload is missing", () => {
    expect(() => selectGeminiVideoPath({
      videoPath: "user/session/original.mp4",
      analysisVideoPath: null,
      analysisInputStrategy: "upright_video",
    })).toThrow("Normalized analysis video path is missing");
  });
});
