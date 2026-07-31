import { createVideoNormalizer } from "./video-normalizer";

const recording = {
  localUri: "file:///set.mp4",
  durationMs: 18_000,
  mimeType: "video/mp4",
};

describe("video normalizer", () => {
  it("returns a full-length upright recording from the native exporter", async () => {
    const native = { normalizeVideoAsync: jest.fn(async () => "file:///set-upright.mp4") };
    const normalize = createVideoNormalizer(native);

    await expect(normalize(recording)).resolves.toEqual({
      localUri: "file:///set-upright.mp4",
      durationMs: 18_000,
      mimeType: "video/mp4",
    });
    expect(native.normalizeVideoAsync).toHaveBeenCalledWith("file:///set.mp4");
  });

  it("fails clearly when the installed development client lacks the native exporter", async () => {
    const normalize = createVideoNormalizer(null);
    await expect(normalize(recording)).rejects.toThrow(/development client/i);
  });

  it("creates a full-duration privacy-safe upper-body copy when the native client supports it", async () => {
    const native = {
      normalizeVideoAsync: jest.fn(async () => "file:///set-upright.mp4"),
      normalizePrivacySafeUpperBodyAsync: jest.fn(async () => "file:///set-upper-body.mp4"),
    };
    const normalizer = createVideoNormalizer(native);

    expect(normalizer.supportsPrivacySafeFallback).toBe(true);
    await expect(normalizer.privacySafeUpperBody(recording)).resolves.toEqual({
      localUri: "file:///set-upper-body.mp4",
      durationMs: 18_000,
      mimeType: "video/mp4",
    });
    expect(native.normalizePrivacySafeUpperBodyAsync).toHaveBeenCalledWith("file:///set.mp4");
  });
});
