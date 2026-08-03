import { createVideoNormalizer } from "./video-normalizer";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

jest.mock("expo-file-system", () => ({
  File: class {
    info() {
      return { size: 4_500_000 };
    }
  },
}));

const recording = {
  localUri: "file:///set.mp4",
  durationMs: 18_000,
  mimeType: "video/mp4",
};

describe("video normalizer", () => {
  it("physically encodes upright 720p AVC at the requested bitrate on both native platforms", () => {
    const android = readFileSync(resolve(__dirname, "../../../modules/form-video-normalizer/android/src/main/java/app/form/coach/videonormalizer/FormVideoNormalizerModule.kt"), "utf8");
    const ios = readFileSync(resolve(__dirname, "../../../modules/form-video-normalizer/ios/FormVideoNormalizerModule.swift"), "utf8");

    expect(android).toContain("setPortraitEncodingEnabled(true)");
    expect(android).toContain("setBitrate(2_750_000)");
    expect(android).not.toContain("setRotationDegrees(0f)");
    expect(ios).toContain("AVVideoAverageBitRateKey: 2_750_000");
    expect(ios).toContain("AVVideoCodecType.h264");
    expect(ios).not.toContain("AVAssetExportPreset1280x720");
  });

  it("returns the original upright pixels without normalization and reports the prepared size", async () => {
    const native = {
      normalizeVideoAsync: jest.fn(async () => recording.localUri),
      prepareVideoAsync: jest.fn(async (uri: string) => uri),
    };
    const normalizer = createVideoNormalizer(native);

    await expect(normalizer.prepare(recording)).resolves.toMatchObject({
      localUri: recording.localUri,
      mimeType: "video/mp4",
      byteLength: 4_500_000,
      normalizationApplied: false,
    });
    expect(native.prepareVideoAsync).toHaveBeenCalledWith(recording.localUri);
  });

  it("reports when orientation normalization produced a new full-duration copy", async () => {
    const native = {
      normalizeVideoAsync: jest.fn(async () => "file:///set-upright.mp4"),
      prepareVideoAsync: jest.fn(async () => "file:///set-upright.mp4"),
    };
    const normalizer = createVideoNormalizer(native);

    await expect(normalizer.prepare(recording)).resolves.toMatchObject({
      localUri: "file:///set-upright.mp4",
      durationMs: recording.durationMs,
      normalizationApplied: true,
      byteLength: 4_500_000,
    });
  });

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
