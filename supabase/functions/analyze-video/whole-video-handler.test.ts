import { analyzeWholeVideoHandler, type WholeVideoHandlerDependencies, type WholeVideoSession } from "./whole-video-handler";

function session(overrides: Partial<WholeVideoSession> = {}): WholeVideoSession {
  return {
    id: "session-1",
    userId: "user-1",
    status: "processing",
    stage: "analyzing",
    failureCode: null,
    videoPath: "videos/session-1.mp4",
    analysisVideoPath: null,
    durationMs: 8_000,
    analysisNextRetryAt: null,
    result: null,
    ...overrides,
  };
}

function dependencies(overrides: Partial<WholeVideoHandlerDependencies> = {}): WholeVideoHandlerDependencies {
  return {
    authenticate: jest.fn(async () => "user-1"),
    loadSession: jest.fn(async () => session()),
    advancePipeline: jest.fn(async () => { throw Object.assign(new Error("contract invalid"), { code: "ANALYSIS_CONTRACT_INVALID" }); }),
    persistFailure: jest.fn(async (_sessionId, _code, disposition) => disposition.disposition === "terminal_failure"
      ? ({ status: "failed", stage: "failed" })
      : ({ status: "processing", stage: "retry_wait" })),
    ...overrides,
  };
}

describe("whole-video handler failure disposition", () => {
  it("moves a repairable finalization failure to retry_wait without another video pass", async () => {
    const stored = session({ stage: "finalizing", analysisRetryCount: 0, hasStoredVideoEvidence: true });
    const deps = dependencies({ loadSession: jest.fn(async () => stored) });
    const response = await analyzeWholeVideoHandler(new Request("https://example/analyze-video", {
      method: "POST",
      body: JSON.stringify({ sessionId: "session-1" }),
    }), deps);

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ status: "processing", stage: "retry_wait" });
    expect(deps.persistFailure).toHaveBeenCalledWith("session-1", "ANALYSIS_CONTRACT_INVALID", expect.objectContaining({
      disposition: "retry_finalization",
      preserveStageOutput: true,
    }));
  });

  it("terminally fails a provider-declared file failure", async () => {
    const deps = dependencies({
      advancePipeline: jest.fn(async () => { throw Object.assign(new Error("provider rejected file"), { code: "GEMINI_FILE_FAILED", providerStatus: "FAILED" }); }),
    });
    const response = await analyzeWholeVideoHandler(new Request("https://example/analyze-video", {
      method: "POST",
      body: JSON.stringify({ sessionId: "session-1" }),
    }), deps);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      sessionId: "session-1",
      status: "failed",
      stage: "failed",
      failureCode: "GEMINI_FILE_FAILED",
      analysisNextRetryAt: null,
    });
    expect(deps.persistFailure).toHaveBeenCalledWith("session-1", "GEMINI_FILE_FAILED", expect.objectContaining({ disposition: "terminal_failure" }));
  });
});
