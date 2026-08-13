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
  it("keeps a slow Gemini file activation in processing for durable retry", async () => {
    const markRetryable = jest.fn(async () => ({
      status: "processing",
      stage: "retry_wait",
      analysisNextRetryAt: "2026-08-12T23:00:05.000Z",
    }));
    const deps = dependencies({
      advancePipeline: jest.fn(async () => { throw Object.assign(new Error("still processing"), { code: "ANALYSIS_FILE_PROCESSING" }); }),
      markRetryable,
    });
    const response = await analyzeWholeVideoHandler(new Request("https://example/analyze-video", {
      method: "POST",
      body: JSON.stringify({ sessionId: "session-1" }),
    }), deps);

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      sessionId: "session-1",
      status: "processing",
      stage: "retry_wait",
      analysisNextRetryAt: "2026-08-12T23:00:05.000Z",
    });
    expect(markRetryable).toHaveBeenCalledWith(expect.objectContaining({ id: "session-1" }), "ANALYSIS_FILE_PROCESSING");
    expect(deps.persistFailure).not.toHaveBeenCalled();
  });

  it("keeps a transient Gemini writer failure in processing for durable retry", async () => {
    const markRetryable = jest.fn(async () => ({
      status: "processing",
      stage: "retry_wait",
      analysisNextRetryAt: "2026-08-13T02:00:05.000Z",
    }));
    const deps = dependencies({
      advancePipeline: jest.fn(async () => { throw Object.assign(new Error("provider unavailable"), { code: "GEMINI_HTTP_503" }); }),
      markRetryable,
    });
    const response = await analyzeWholeVideoHandler(new Request("https://example/analyze-video", {
      method: "POST",
      body: JSON.stringify({ sessionId: "session-1" }),
    }), deps);

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      sessionId: "session-1",
      status: "processing",
      stage: "retry_wait",
      analysisNextRetryAt: "2026-08-13T02:00:05.000Z",
    });
    expect(markRetryable).toHaveBeenCalledWith(expect.objectContaining({ id: "session-1" }), "GEMINI_HTTP_503");
    expect(deps.persistFailure).not.toHaveBeenCalled();
  });
});
