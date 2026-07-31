import { captureVideoSettings } from "./video-settings";

describe("capture video settings", () => {
  it("uses an upload-efficient recording profile for Gemini analysis", () => {
    expect(captureVideoSettings).toEqual({
      maxDurationSeconds: 15,
      quality: "720p",
      minimumDurationMs: 3_000,
      countdownSeconds: 10,
    });
  });
});
