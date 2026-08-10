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
    markFailed: jest.fn(async () => ({ status: "failed", stage: "failed" })),
    ...overrides,
  };
}

describe("whole-video handler failure disposition", () => {
  it("returns a terminal failure instead of retry_wait when the single-call pipeline fails", async () => {
    const deps = dependencies();
    const response = await analyzeWholeVideoHandler(new Request("https://example/analyze-video", {
      method: "POST",
      body: JSON.stringify({ sessionId: "session-1" }),
    }), deps);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      sessionId: "session-1",
      status: "failed",
      stage: "failed",
      failureCode: "ANALYSIS_CONTRACT_INVALID",
      analysisNextRetryAt: null,
    });
    expect(deps.markFailed).toHaveBeenCalledWith("session-1", "ANALYSIS_CONTRACT_INVALID");
  });
});
