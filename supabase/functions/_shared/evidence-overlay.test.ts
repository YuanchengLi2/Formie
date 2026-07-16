import { buildEvidenceOverlays } from "./evidence-overlay";

const summary = {
  version: 1 as const,
  model: "MoveNet.SinglePose.Thunder" as const,
  durationMs: 2_000,
  requestedFrames: 8,
  framesAnalyzed: 8,
  sampleFps: 4,
  overallVisibility: 0.9,
  seriesColumns: ["timeMs", "confidence", "leftElbowX", "leftElbowY", "rightElbowX", "rightElbowY", "leftWristX", "leftWristY", "rightWristX", "rightWristY"],
  series: [
    [250, 0.9, 0.3, 0.4, 0.7, 0.4, 0.25, 0.6, 0.75, 0.6],
    [500, 0.92, 0.35, 0.42, 0.65, 0.42, 0.3, 0.62, 0.7, 0.62],
    [750, 0.91, 0.4, 0.44, 0.6, 0.44, 0.35, 0.64, 0.65, 0.64],
    [1_000, 0.9, 0.42, 0.45, 0.58, 0.45, 0.38, 0.65, 0.62, 0.65],
  ],
};

function finding(id: string, peakMs: number, visibleBodyAreas: string[]) {
  return {
    id,
    evidence: [{ startMs: peakMs - 250, peakMs, endMs: peakMs + 250, visibleBodyAreas }],
  };
}

describe("buildEvidenceOverlays", () => {
  it("centers a finding on the named Thunder joints nearest its evidence timestamp", () => {
    const overlays = buildEvidenceOverlays(summary, [finding("elbow-drift", 540, ["left elbow", "right elbow"])]);

    expect(overlays).toEqual([expect.objectContaining({
      findingId: "elbow-drift",
      timeMs: 500,
      centerX: 0.5,
      centerY: 0.42,
      trackedAreas: ["left elbow", "right elbow"],
    })]);
    expect(overlays[0].radius).toBeGreaterThan(0.1);
  });

  it("maps implement and bar-path evidence to tracked wrists without AI coordinates", () => {
    const overlays = buildEvidenceOverlays(summary, [finding("bar-path", 760, ["bar path"])]);

    expect(overlays[0]).toMatchObject({ findingId: "bar-path", timeMs: 750, centerX: 0.5, centerY: 0.64 });
  });

  it("omits an overlay when no named area can be grounded in visible Thunder points", () => {
    expect(buildEvidenceOverlays(summary, [finding("unknown", 500, ["facial expression"])] )).toEqual([]);
  });
});
