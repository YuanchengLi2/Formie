import { createRecordingPreflightFrames } from "./recording-preflight";

describe("recording preflight frame preparation", () => {
  it("extracts twenty-four ordered one-tile frames across the complete local recording", async () => {
    const getThumbnail = jest.fn(async (_uri: string, options: { time: number }) => ({
      uri: `file:///frame-${options.time}.jpg`,
      width: 1080,
      height: 1920,
    }));
    const compressFrame = jest.fn(async (uri: string, resize: { width?: number; height?: number }) => ({
      base64: `encoded-${uri}`,
      width: resize.width ?? 216,
      height: resize.height ?? 384,
    }));

    const frames = await createRecordingPreflightFrames(
      { localUri: "file:///set.mp4", durationMs: 10_000, mimeType: "video/mp4" },
      { getThumbnail, compressFrame },
    );

    expect(frames).toHaveLength(24);
    expect(frames[0]?.timeMs).toBe(208);
    expect(frames.at(-1)?.timeMs).toBe(9_792);
    expect(frames.every((frame, index) => index === 0 || frame.timeMs > frames[index - 1]!.timeMs)).toBe(true);
    expect(getThumbnail).toHaveBeenCalledTimes(24);
    expect(compressFrame).toHaveBeenCalledTimes(24);
    expect(compressFrame).toHaveBeenCalledWith(expect.any(String), { height: 384 });
  });
});
