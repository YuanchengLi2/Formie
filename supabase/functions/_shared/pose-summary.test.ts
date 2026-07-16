import { validatePoseSummary } from "./pose-summary";

describe("validatePoseSummary", () => {
  const valid = {
    version: 1,
    model: "MoveNet.SinglePose.Thunder",
    durationMs: 10_000,
    requestedFrames: 40,
    framesAnalyzed: 36,
    sampleFps: 3.6,
    overallVisibility: 0.88,
    seriesColumns: ["timeMs", "confidence", "leftWristX"],
    series: [[0, 0.9, 0.2], [250, 0.91, 0.21], [500, 0.92, 0.23], [750, 0.9, 0.25]],
  };

  it("accepts a bounded MoveNet Thunder summary", () => {
    expect(validatePoseSummary(valid, 10_000)).toEqual(valid);
  });

  it("rejects pose timestamps outside the recording", () => {
    const value = { ...valid, series: [...valid.series, [10_001, 0.9, 0.2]] };
    expect(() => validatePoseSummary(value, 10_000)).toThrow("timestamp");
  });

  it("rejects oversized or unknown pose payloads", () => {
    expect(() => validatePoseSummary({ ...valid, model: "unknown" }, 10_000)).toThrow("model");
    expect(() => validatePoseSummary({ ...valid, series: Array.from({ length: 97 }, (_, index) => [index * 10, 0.9, 0.2]) }, 10_000)).toThrow("frames");
  });
});
