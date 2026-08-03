import { prepareV49InlineVideo, selectV49VideoPath } from "./video-input";

it("selects the normalized full-duration input without importing the old analyzer", () => {
  expect(selectV49VideoPath({ videoPath: "original.mp4", analysisVideoPath: "analysis-input.mp4", analysisInputStrategy: "capture_ready_video" })).toBe("analysis-input.mp4");
});

it("fails when the selected normalized video is missing", () => {
  expect(() => selectV49VideoPath({ videoPath: "original.mp4", analysisVideoPath: null, analysisInputStrategy: "capture_ready_video" })).toThrow(/normalized/i);
});

it("encodes the retained short video inline and hashes the exact bytes", async () => {
  const prepared = await prepareV49InlineVideo(new Blob([new Uint8Array([0, 1, 2, 253, 254, 255])], { type: "video/mp4" }));

  expect(prepared.video).toEqual({ kind: "inline", data: "AAEC/f7/", mimeType: "video/mp4" });
  expect(prepared.byteLength).toBe(6);
  expect(prepared.sha256).toMatch(/^[a-f0-9]{64}$/);
});

it("rejects an empty retained video before calling Gemini", async () => {
  await expect(prepareV49InlineVideo(new Blob([], { type: "video/mp4" }))).rejects.toThrow(/empty/i);
});
