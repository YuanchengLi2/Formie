import {
  compatibleResult,
  compatibleStagePairs,
  hasScoreApplyConfirmation,
  jsonValuesEqual,
  type StageRow,
} from "./recalculate-compatible-analysis-scores";

const issue = {
  id: "issue-1",
  severity: "important",
  prevalence: "throughout",
  confidence: 0.7,
  observation: "The elbow path changes throughout the set.",
  evidence: [{ peakMs: 3_000 }],
};
const analyzingOutput = { analysis: { issues: [issue] } };
const finalizingOutput = {
  analysis_draft: {
    analysis: { issues: [issue] },
    writing: { movementScores: [{ id: "path", label: "Path", observed: "The path changes.", evidenceIds: ["issue-1"] }] },
  },
};

function stage(overrides: Partial<StageRow>): StageRow {
  return {
    session_id: "session-1",
    pipeline_version: "pipeline-1",
    input_checksum: "checksum-1",
    stage: "analyzing",
    output: analyzingOutput,
    updated_at: "2026-08-23T00:00:00Z",
    ...overrides,
  };
}

describe("compatible score recalculation", () => {
  it("uses the self-contained finalizing payload without combining different stage checksums", () => {
    const pairs = compatibleStagePairs([
      stage({ input_checksum: "checksum-a" }),
      stage({ stage: "finalizing", input_checksum: "checksum-b", output: finalizingOutput }),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ sessionId: "session-1", pipelineVersion: "pipeline-1", inputChecksum: "checksum-b" });
    expect(pairs[0]?.analyzingOutput).toBe(finalizingOutput);
  });

  it("selects only the newest complete finalizing attempt for a session", () => {
    const pairs = compatibleStagePairs([
      stage({ stage: "finalizing", input_checksum: "older", output: finalizingOutput, updated_at: "2026-08-22T00:00:00Z" }),
      stage({ stage: "finalizing", input_checksum: "newer", output: finalizingOutput, updated_at: "2026-08-23T00:00:00Z" }),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.inputChecksum).toBe("newer");
  });

  it("recalculates movement and overall scores from the complete analyst evidence", () => {
    const result = compatibleResult(analyzingOutput, finalizingOutput);
    expect(result).toMatchObject({ score: 82, movementScores: [{ id: "path", score: 82 }] });
    expect(result?.scoreRationale).toEqual([expect.objectContaining({ criterion: "issue-1", rubricVersion: "severity-v1" })]);
  });

  it("requires an explicit rubric confirmation before applying writes", () => {
    expect(hasScoreApplyConfirmation(["--apply"])).toBe(false);
    expect(hasScoreApplyConfirmation(["--apply", "--confirm-rubric=severity-v1"])).toBe(true);
    expect(hasScoreApplyConfirmation(["--confirm-rubric=severity-v1"])).toBe(false);
  });

  it("treats JSONB key reordering as unchanged", () => {
    expect(jsonValuesEqual(
      [{ criterion: "issue-1", impact: 18, evidenceIds: ["issue-1:3000"] }],
      [{ evidenceIds: ["issue-1:3000"], impact: 18, criterion: "issue-1" }],
    )).toBe(true);
  });
});
