import { verifyRetainedAnalysisInput } from "./reusable-input";

describe("verifyRetainedAnalysisInput", () => {
  it("accepts a storage path only when the object still exists", async () => {
    const videoExists = jest.fn(async () => true);
    const getGeminiFileState = jest.fn(async () => "FAILED");

    await expect(verifyRetainedAnalysisInput(
      { videoPath: "user/session/original.mp4", geminiFileName: "files/stale" },
      { videoExists, getGeminiFileState },
    )).resolves.toBe("ready");

    expect(videoExists).toHaveBeenCalledWith("user/session/original.mp4");
    expect(getGeminiFileState).not.toHaveBeenCalled();
  });

  it("falls back to an active Gemini file when the storage object is gone", async () => {
    await expect(verifyRetainedAnalysisInput(
      { videoPath: "user/session/original.mp4", geminiFileName: "files/active" },
      {
        videoExists: jest.fn(async () => false),
        getGeminiFileState: jest.fn(async () => "ACTIVE"),
      },
    )).resolves.toBe("ready");
  });

  it("rejects database pointers when neither retained input is reusable", async () => {
    await expect(verifyRetainedAnalysisInput(
      { videoPath: "user/session/original.mp4", geminiFileName: "files/stale" },
      {
        videoExists: jest.fn(async () => false),
        getGeminiFileState: jest.fn(async () => "FAILED"),
      },
    )).resolves.toBe("video_missing");
  });
});
