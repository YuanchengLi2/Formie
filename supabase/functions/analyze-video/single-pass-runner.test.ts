import { advanceSinglePassPipeline, type SinglePassPipelineSession } from "./single-pass-runner";

const sourceDecision = {
  status: "complete",
  score: 72,
  findings: [
    { id: "first", kind: "correction" },
    { id: "second", kind: "correction" },
    { id: "third", kind: "correction" },
  ],
} as Record<string, unknown>;
const finalResult = { status: "complete", score: 72, priorityCorrections: [{ id: "limiter" }] } as Record<string, unknown>;
const writerCopy = { overallAssessment: "Strict coaching", findings: [], nextSetPlan: [] } as Record<string, unknown>;
const movementLocalization = {
  outcome: "movement_found",
  activeSetStartMs: 400,
  activeSetEndMs: 3_300,
  repetitions: [
    { startMs: 400, peakMs: 600, endMs: 900, observation: "Rep one." },
    { startMs: 1_000, peakMs: 1_500, endMs: 1_850, observation: "Rep two." },
    { startMs: 2_400, peakMs: 2_850, endMs: 3_300, observation: "Rep three." },
  ],
  movementEvidence: ["Three repeated paths are visible."],
} as Record<string, unknown>;

function session(overrides: Partial<SinglePassPipelineSession> = {}): SinglePassPipelineSession {
  return {
    id: "session-1",
    durationMs: 25_000,
    file: { uri: "gemini://video", mimeType: "video/mp4" },
    analysisDecision: null,
    writerCopy: null,
    contradictions: [],
    finalResult: null,
    ...overrides,
  } as SinglePassPipelineSession;
}

function dependencies() {
  return {
    localizeMovement: jest.fn(async () => movementLocalization),
    analyze: jest.fn(async () => ({ decision: sourceDecision, contradictions: [] })),
    confirmUnable: jest.fn(async ({ decision }) => ({ decision, contradictions: [] })),
    writeAndAudit: jest.fn(async () => ({ writerCopy, contradictions: [] })),
    reviewContradictions: jest.fn(async () => ({ decision: sourceDecision, writerCopy })),
    setStage: jest.fn(async () => undefined),
    saveAnalysis: jest.fn(async () => undefined),
    assembleResult: jest.fn(() => finalResult),
    saveResult: jest.fn(async () => undefined),
  };
}

describe("single-pass pipeline runner", () => {
  it("persists factual analysis and yields before starting text-only coaching", async () => {
    const deps = dependencies();
    const result = await advanceSinglePassPipeline(session(), deps);
    expect(result).toEqual({ status: "processing", stage: "checking_consistency" });
    expect(deps.analyze).toHaveBeenCalledWith({
      sessionId: "session-1",
      file: { uri: "gemini://video", mimeType: "video/mp4" },
      durationMs: 25_000,
      movementLocalization,
    });
    expect(deps.confirmUnable).not.toHaveBeenCalled();
    expect(deps.writeAndAudit).not.toHaveBeenCalled();
    expect(deps.reviewContradictions).not.toHaveBeenCalled();
    expect(deps.saveAnalysis).toHaveBeenCalledWith("session-1", sourceDecision, null, []);
    expect(deps.assembleResult).not.toHaveBeenCalled();
    expect(deps.saveResult).not.toHaveBeenCalled();
  });

  it("independently confirms an unable first pass before persisting it", async () => {
    const deps = dependencies();
    const unable = {
      status: "unable",
      videoCheck: {
        retryReason: "No exercise movement is visible.",
        retryInstruction: "Record the complete set.",
      },
    } as Record<string, unknown>;
    const recovered = { ...sourceDecision, status: "complete" };
    deps.analyze.mockResolvedValueOnce({ decision: unable, contradictions: [] });
    deps.confirmUnable.mockResolvedValueOnce({ decision: recovered, contradictions: [] });

    const result = await advanceSinglePassPipeline(session(), deps);

    expect(deps.confirmUnable).toHaveBeenCalledWith({
      sessionId: "session-1",
      file: { uri: "gemini://video", mimeType: "video/mp4" },
      durationMs: 25_000,
      decision: unable,
      movementLocalization,
    });
    expect(deps.saveAnalysis).toHaveBeenCalledWith("session-1", recovered, null, []);
    expect(result).toEqual({ status: "processing", stage: "checking_consistency" });
  });

  it("refuses to persist no-reps when the dedicated temporal pass found repetitions", async () => {
    const deps = dependencies();
    const unable = {
      status: "unable",
      videoCheck: {
        retryReason: "No repetitions are visible.",
        retryInstruction: "Record the complete set.",
      },
    } as Record<string, unknown>;
    deps.analyze.mockResolvedValueOnce({ decision: unable, contradictions: [] });
    deps.confirmUnable.mockResolvedValueOnce({ decision: unable, contradictions: [] });

    await expect(advanceSinglePassPipeline(session(), deps)).rejects.toMatchObject({
      code: "ANALYSIS_MOVEMENT_CONTRADICTION",
    });
    expect(deps.saveAnalysis).not.toHaveBeenCalled();
  });

  it("resumes with the writer and publishes without rerunning video analysis", async () => {
    const deps = dependencies();
    const result = await advanceSinglePassPipeline(session({
      analysisDecision: sourceDecision,
    }), deps);
    expect(result).toEqual({ status: "complete", stage: "complete", result: finalResult });
    expect(deps.analyze).not.toHaveBeenCalled();
    expect(deps.writeAndAudit).toHaveBeenCalledWith({
      sessionId: "session-1",
      decision: sourceDecision,
      durationMs: 25_000,
    });
    expect(deps.saveAnalysis).toHaveBeenCalledWith("session-1", sourceDecision, writerCopy, []);
    expect(deps.saveResult).toHaveBeenCalledWith("session-1", finalResult);
  });

  it("resumes from saved analyst and writer results without rerunning either model", async () => {
    const deps = dependencies();
    const result = await advanceSinglePassPipeline(session({ analysisDecision: sourceDecision, writerCopy } as Partial<SinglePassPipelineSession>), deps);
    expect(result).toEqual({ status: "complete", stage: "complete", result: finalResult });
    expect(deps.analyze).not.toHaveBeenCalled();
    expect(deps.writeAndAudit).not.toHaveBeenCalled();
    expect(deps.assembleResult).toHaveBeenCalledWith(sourceDecision, writerCopy);
    expect(deps.saveResult).toHaveBeenCalledWith("session-1", finalResult);
  });

  it("publishes retry guidance from an unable analyst decision", async () => {
    const deps = dependencies();
    const unable = {
      status: "unable",
      overallAssessment: "No person or exercise movement is visible.",
      score: null,
      findings: [],
      videoCheck: {
        retryReason: "No person or exercise movement is visible.",
        retryInstruction: "Record again with your full body visible.",
      },
    };
    const unableResult = { ...unable, priorityCorrections: [], didWell: [], coachingCues: [] };
    deps.assembleResult.mockReturnValueOnce(unableResult);
    const result = await advanceSinglePassPipeline(session({
      analysisDecision: unable,
      writerCopy: null,
    } as Partial<SinglePassPipelineSession>), deps);
    expect(deps.analyze).not.toHaveBeenCalled();
    expect(deps.writeAndAudit).not.toHaveBeenCalled();
    expect(deps.assembleResult).toHaveBeenCalledWith(unable, null);
    expect(deps.saveResult).toHaveBeenCalledWith("session-1", unableResult);
    expect(result).toMatchObject({
      status: "unable",
      result: {
        videoCheck: {
          retryReason: "No person or exercise movement is visible.",
          retryInstruction: "Record again with your full body visible.",
        },
      },
    });
  });

  it("rewatches only targeted windows when a factual contradiction is detected", async () => {
    const deps = dependencies();
    const contradiction = {
      kind: "timestamp" as const,
      findingId: "first",
      startMs: 6_000,
      endMs: 8_000,
      description: "The cited repetition and timestamp disagree.",
    };
    deps.writeAndAudit.mockResolvedValueOnce({ writerCopy, contradictions: [] });

    await advanceSinglePassPipeline(session({
      analysisDecision: sourceDecision,
      contradictions: [contradiction],
    }), deps);

    expect(deps.writeAndAudit).toHaveBeenCalled();
    expect(deps.setStage).toHaveBeenCalledWith("session-1", "double_checking");
    expect(deps.reviewContradictions).not.toHaveBeenCalled();
    expect(deps.saveAnalysis).toHaveBeenCalledWith("session-1", sourceDecision, writerCopy, [contradiction]);
  });

  it("resumes a targeted contradiction review without rerunning the writer", async () => {
    const deps = dependencies();
    const contradiction = {
      kind: "timestamp" as const,
      findingId: "first",
      startMs: 6_000,
      endMs: 8_000,
      description: "The cited repetition and timestamp disagree.",
    };

    await advanceSinglePassPipeline(session({
      analysisDecision: sourceDecision,
      writerCopy,
      contradictions: [contradiction],
    }), deps);

    expect(deps.analyze).not.toHaveBeenCalled();
    expect(deps.writeAndAudit).not.toHaveBeenCalled();
    expect(deps.reviewContradictions).toHaveBeenCalledWith({
      sessionId: "session-1",
      file: { uri: "gemini://video", mimeType: "video/mp4" },
      durationMs: 25_000,
      decision: sourceDecision,
      writerCopy,
      contradictions: [contradiction],
    });
    expect(deps.saveAnalysis).toHaveBeenCalledWith("session-1", sourceDecision, writerCopy, []);
    expect(deps.saveResult).toHaveBeenCalledWith("session-1", finalResult);
  });
});
