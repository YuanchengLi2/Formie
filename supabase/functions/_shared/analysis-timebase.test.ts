import { rebaseAnalysisDecisionTimestamps } from "./analysis-timebase";

describe("rebaseAnalysisDecisionTimestamps", () => {
  it("maps every analysis timestamp back onto the untouched original recording", () => {
    const decision = {
      findings: [{
        id: "finding-1",
        evidence: [{ startMs: 100, peakMs: 300, endMs: 600 }],
      }],
      repTimeline: [{ repNumber: 1, startMs: 1_000, peakMs: 1_500, endMs: 2_000 }],
      wholeSetCoverage: {
        activeSetStartMs: 500,
        activeSetEndMs: 8_000,
        checkpoints: [
          { position: "beginning", startMs: 500, endMs: 1_000 },
          { position: "middle", startMs: 3_500, endMs: 4_000 },
          { position: "end", startMs: 7_000, endMs: 8_000 },
        ],
      },
    };

    expect(rebaseAnalysisDecisionTimestamps(decision, 4_000)).toEqual({
      findings: [{
        id: "finding-1",
        evidence: [{ startMs: 4_100, peakMs: 4_300, endMs: 4_600 }],
      }],
      repTimeline: [{ repNumber: 1, startMs: 5_000, peakMs: 5_500, endMs: 6_000 }],
      wholeSetCoverage: {
        activeSetStartMs: 4_500,
        activeSetEndMs: 12_000,
        checkpoints: [
          { position: "beginning", startMs: 4_500, endMs: 5_000 },
          { position: "middle", startMs: 7_500, endMs: 8_000 },
          { position: "end", startMs: 11_000, endMs: 12_000 },
        ],
      },
    });
  });

  it("does not mutate the stored model response", () => {
    const decision = {
      findings: [{ evidence: [{ startMs: 0, peakMs: 100, endMs: 200 }] }],
      repTimeline: [],
      wholeSetCoverage: null,
    };

    rebaseAnalysisDecisionTimestamps(decision, 2_000);

    expect(decision.findings[0].evidence[0]).toEqual({ startMs: 0, peakMs: 100, endMs: 200 });
  });
});
