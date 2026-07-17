import { REQUESTED_ANALYSIS_FPS } from "./analysis-settings";

describe("analysis settings", () => {
  it("requests 18 FPS for the main Gemini movement analysis", () => {
    expect(REQUESTED_ANALYSIS_FPS).toBe(18);
  });
});
