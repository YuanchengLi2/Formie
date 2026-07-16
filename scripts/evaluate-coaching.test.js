const { evaluateRows } = require("./evaluate-coaching.cjs");

describe("coaching evaluation", () => {
  it("measures recognition, correction agreement, evidence timing, and verifier use", () => {
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
    expect(report.verifierInvocationRate).toBe(0.5);
    expect(report.premiumRunsAverage).toBe(1);
    expect(report.verifierUsage).toEqual({ promptTokens: 200, outputTokens: 50, thinkingTokens: 15 });
    expect(report.failures).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "squat-miss", checks: expect.arrayContaining(["exercise", "priority-correction", "evidence-time", "camera-commentary"]) }),
    ]));
  });
});
