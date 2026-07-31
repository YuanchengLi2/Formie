const { evaluateRows } = require("./evaluate-coaching.cjs");

describe("coaching evaluation", () => {
  it("measures public coaching without depending on retired reviewer payloads", () => {
    const report = evaluateRows([
      {
        id: "curl-clean",
        expectedExercise: ["hammer curl", "dumbbell curl"],
        expectedPriorityKeywords: ["elbow", "forward"],
        expectedEvidenceMs: 8_300,
        result: {
          recognition: { label: "Hammer Curl" },
          priorityCorrections: [{ title: "Elbow drift", detail: "The elbows moved forward.", correction: "Keep elbows beside the torso.", evidence: [{ peakMs: 8_350 }] }],
          precisionReview: {
            runsRequested: 2,
            runsUsed: 2,
            status: "completed",
            passes: [
              { usage: { promptTokens: 120, outputTokens: 30, thinkingTokens: 10 } },
              { usage: { promptTokens: 80, outputTokens: 20, thinkingTokens: 5 } },
            ],
          },
          verification: { performed: true, outcome: "confirmed" },
        },
      },
      {
        id: "squat-miss",
        expectedExercise: ["goblet squat"],
        expectedPriorityKeywords: ["depth"],
        expectedEvidenceMs: 4_000,
        result: {
          recognition: { label: "Lunge" },
          priorityCorrections: [{ title: "Setup", detail: "Change the camera angle.", correction: "Move the phone.", evidence: [{ peakMs: 6_000 }] }],
          verification: { performed: false, outcome: "not-needed" },
        },
      },
    ]);

    expect(report.total).toBe(2);
    expect(report.exerciseRecognitionRate).toBe(0.5);
    expect(report.priorityCorrectionAgreementRate).toBe(0.5);
    expect(report.evidenceWithinToleranceRate).toBe(0.5);
    expect(report.cameraCommentaryRate).toBe(0.5);
    expect(report.verifierInvocationRate).toBe(0);
    expect(report.premiumRunsAverage).toBe(0);
    expect(report.verifierUsage).toEqual({ promptTokens: 0, outputTokens: 0, thinkingTokens: 0 });
    expect(report.failures).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "squat-miss", checks: expect.arrayContaining(["exercise", "priority-correction", "evidence-time", "camera-commentary"]) }),
    ]));
  });

  it("measures point-specific coaching coverage and unsupported causal claims", () => {
    const report = evaluateRows([
      {
        id: "grounded-points",
        expectedExercise: "squat",
        result: {
          recognition: { label: "Squat" },
          priorityCorrections: [{ title: "Knee path", evidence: [
            { peakMs: 8_000, repNumber: 3, coachingNote: "your knees move inward as your heels lift. Keep three points of each foot planted." },
            { peakMs: 12_000, repNumber: 4, coachingNote: "the same knee drift repeats. Drive each knee over the second toe." },
          ] }],
        },
      },
      {
        id: "unsupported-points",
        expectedExercise: "curl",
        result: {
          recognition: { label: "Curl" },
          priorityCorrections: [{ title: "Elbow path", evidence: [
            { peakMs: 2_000, repNumber: 1 },
            { peakMs: 3_000, repNumber: 1, coachingNote: "your biceps stop activating from fatigue, so reduce the weight." },
          ] }],
        },
      },
    ]);

    expect(report.pointAdviceCoverageRate).toBe(0.75);
    expect(report.unsupportedInternalClaimRate).toBe(0.5);
    expect(report.fatigueWithoutRepeatedEvidenceRate).toBe(0.5);
    expect(report.failures).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "unsupported-points", checks: expect.arrayContaining(["point-advice", "hidden-inference", "unsupported-fatigue"]) }),
    ]));
  });
});
