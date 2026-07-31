import { REQUESTED_ANALYSIS_FPS, REQUESTED_ANALYSIS_MEDIA_RESOLUTION } from "./analysis-settings";

describe("analysis settings", () => {
  it("uses Gemini native temporal sampling at high resolution for movement analysis", () => {
    expect(REQUESTED_ANALYSIS_FPS).toBe(12);
    expect(REQUESTED_ANALYSIS_MEDIA_RESOLUTION).toBe("MEDIA_RESOLUTION_HIGH");
  });
});
