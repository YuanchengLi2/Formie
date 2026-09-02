import { analyzeWholeVideoHandler, type WholeVideoHandlerDependencies, type WholeVideoSession } from "./whole-video-handler";
import { AiEligibilityError } from "../_shared/ai-eligibility";

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
  it("returns AI_CONSENT_REQUIRED without loading or advancing the session", async () => {
    const deps = dependencies({ authenticate: jest.fn(async () => { throw new AiEligibilityError("AI_CONSENT_REQUIRED"); }) });
    const response = await analyzeWholeVideoHandler(new Request("https://example/analyze-video", {
      method: "POST", body: JSON.stringify({ sessionId: "session-1" }),
    }), deps);
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "AI_CONSENT_REQUIRED" });
    expect(deps.loadSession).not.toHaveBeenCalled();
    expect(deps.advancePipeline).not.toHaveBeenCalled();
    expect(deps.persistFailure).not.toHaveBeenCalled();
  });
  it("keeps a slow Gemini file activation in processing for durable retry", async () => {
    const persistFailure = jest.fn(async () => ({
      status: "processing",
      stage: "retry_wait",
      analysisNextRetryAt: "2026-08-12T23:00:05.000Z",
    }));
    const deps = dependencies({
      advancePipeline: jest.fn(async () => { throw Object.assign(new Error("still processing"), { code: "ANALYSIS_FILE_PROCESSING" }); }),
      persistFailure,
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
    expect(persistFailure).toHaveBeenCalledWith("session-1", "ANALYSIS_FILE_PROCESSING", expect.objectContaining({ disposition: "retry_video_file" }));
  });

  it("keeps a transient Gemini writer failure in processing for durable retry", async () => {
    const persistFailure = jest.fn(async () => ({
      status: "processing",
      stage: "retry_wait",
      analysisNextRetryAt: "2026-08-13T02:00:05.000Z",
    }));
    const deps = dependencies({
      advancePipeline: jest.fn(async () => { throw Object.assign(new Error("provider unavailable"), { code: "GEMINI_HTTP_503" }); }),
      persistFailure,
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
    expect(persistFailure).toHaveBeenCalledWith("session-1", "GEMINI_HTTP_503", expect.objectContaining({ disposition: "retry_video_file" }));
  });

  it("stops a transient provider failure after the bounded retry budget is exhausted", async () => {
    const persistFailure = jest.fn(async () => ({ status: "failed", stage: "failed" }));
    const deps = dependencies({
      loadSession: jest.fn(async () => session({ analysisRetryCount: 3 })),
      advancePipeline: jest.fn(async () => { throw Object.assign(new Error("provider unavailable"), { code: "GEMINI_HTTP_503", httpStatus: 503 }); }),
      persistFailure,
    });
    const response = await analyzeWholeVideoHandler(new Request("https://example/analyze-video", {
      method: "POST",
      body: JSON.stringify({ sessionId: "session-1" }),
    }), deps);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "failed", stage: "failed", failureCode: "GEMINI_HTTP_503" });
    expect(persistFailure).toHaveBeenCalledWith("session-1", "GEMINI_HTTP_503", expect.objectContaining({ disposition: "terminal_failure", exhausted: true }));
  });

  it("reconciles an orphaned failed stage before attempting the pipeline again", async () => {
    const advancePipeline = jest.fn(async () => ({ status: "complete", stage: "complete" }));
    const persistFailure = jest.fn(async () => ({ status: "failed", stage: "failed" }));
    const deps = dependencies({
      loadSession: jest.fn(async () => session({ failedStageErrorCode: "GEMINI_PROHIBITED_CONTENT" })),
      advancePipeline,
      persistFailure,
    });
    const response = await analyzeWholeVideoHandler(new Request("https://example/analyze-video", {
      method: "POST",
      body: JSON.stringify({ sessionId: "session-1" }),
    }), deps);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "failed",
      stage: "failed",
      failureCode: "GEMINI_PROHIBITED_CONTENT",
    });
    expect(advancePipeline).not.toHaveBeenCalled();
    expect(persistFailure).toHaveBeenCalledWith(
      "session-1",
      "GEMINI_PROHIBITED_CONTENT",
      expect.objectContaining({ disposition: "terminal_failure" }),
    );
  });
});
