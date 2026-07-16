import { buildPoseSummary, poseFrameTimestamps } from "./pose-summary";

const point = (name: string, x: number, y: number, score = 0.95) => ({ name, x, y, score });

describe("poseFrameTimestamps", () => {
  it("samples a short set at the requested rate", () => {
    const times = poseFrameTimestamps(10_000, { targetFps: 4, maxFrames: 96 });
    expect(times).toHaveLength(40);
    expect(times[0]).toBe(0);
    expect(times.at(-1)).toBe(9_750);
  });

  it("caps long recordings while spanning the full set", () => {
    const times = poseFrameTimestamps(60_000, { targetFps: 4, maxFrames: 96 });
    expect(times).toHaveLength(96);
    expect(times[0]).toBe(0);
    expect(times.at(-1)).toBeGreaterThan(59_000);
  });
});

describe("buildPoseSummary", () => {
  it("compacts Thunder landmarks into timestamped joint measurements", () => {
    const keypoints = [
      point("left_shoulder", 0.3, 0.3), point("right_shoulder", 0.7, 0.3),
      point("left_elbow", 0.3, 0.5), point("right_elbow", 0.7, 0.5),
      point("left_wrist", 0.5, 0.5), point("right_wrist", 0.5, 0.5),
      point("left_hip", 0.35, 0.65), point("right_hip", 0.65, 0.65),
      point("left_knee", 0.35, 0.8), point("right_knee", 0.65, 0.8),
      point("left_ankle", 0.35, 0.95), point("right_ankle", 0.65, 0.95),
    ];
    const summary = buildPoseSummary([
      { timeMs: 0, keypoints },
      { timeMs: 250, keypoints },
      { timeMs: 500, keypoints },
      { timeMs: 750, keypoints },
    ], 1_000);

    expect(summary).toMatchObject({ model: "MoveNet.SinglePose.Thunder", framesAnalyzed: 4, durationMs: 1_000 });
    expect(summary?.seriesColumns).toEqual(expect.arrayContaining(["timeMs", "leftElbowAngle", "rightElbowAngle", "wristHeightDelta"]));
    const elbowColumn = summary!.seriesColumns.indexOf("leftElbowAngle");
    expect(summary!.series[0][elbowColumn]).toBe(90);
    expect(summary!.overallVisibility).toBeGreaterThan(0.9);
  });

  it("returns null when too few reliable frames are available", () => {
    expect(buildPoseSummary([{ timeMs: 0, keypoints: [point("left_shoulder", 0.2, 0.2, 0.1)] }], 10_000)).toBeNull();
  });
});
