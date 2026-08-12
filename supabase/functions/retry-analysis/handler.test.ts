import { retryAnalysisHandler, type RetryAnalysisDependencies } from "./handler";

function dependencies(overrides: Partial<RetryAnalysisDependencies> = {}): RetryAnalysisDependencies {
  return {
    primaryV49Enabled: true,
    authenticate: jest.fn(async () => undefined),
    findDueSessions: jest.fn(async () => [{ id: "session-1", userId: "user-1", pipelineVersion: "legacy-retryable" }]),
    invokeAnalysis: jest.fn(async () => 202),
    now: () => new Date("2026-08-02T16:00:00.000Z"),
    ...overrides,
  };
}

describe("retry-analysis worker", () => {
  it("invokes due processing sessions without publishing a terminal failure", async () => {
    const deps = dependencies();
    const response = await retryAnalysisHandler(new Request("https://example/retry-analysis", { method: "POST" }), deps);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ processed: 1, succeeded: 1, failed: 0 });
    expect(deps.invokeAnalysis).toHaveBeenCalledWith({ id: "session-1", userId: "user-1", pipelineVersion: "legacy-retryable" });
  });

  it("continues through individual invocation failures", async () => {
    const deps = dependencies({
      findDueSessions: jest.fn(async () => [
        { id: "session-1", userId: "user-1", pipelineVersion: "legacy-retryable" },
        { id: "session-2", userId: "user-2", pipelineVersion: "legacy-retryable" },
      ]),
      invokeAnalysis: jest.fn()
        .mockResolvedValueOnce(503)
        .mockRejectedValueOnce(new Error("network")),
    });
    const response = await retryAnalysisHandler(new Request("https://example/retry-analysis", { method: "POST" }), deps);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ processed: 2, succeeded: 0, failed: 2 });
  });

  it("rejects unauthenticated cron requests", async () => {
    const response = await retryAnalysisHandler(new Request("https://example/retry-analysis", { method: "POST" }), dependencies({
      authenticate: jest.fn(async () => { throw new Error("UNAUTHORIZED"); }),
    }));
    expect(response.status).toBe(401);
  });

  it("resumes due v48 runs when the v49 cutover is disabled", async () => {
    const deps = dependencies({ primaryV49Enabled: false });
    const response = await retryAnalysisHandler(new Request("https://example/retry-analysis", { method: "POST" }), deps);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ processed: 1, succeeded: 1, failed: 0 });
    expect(deps.findDueSessions).toHaveBeenCalled();
    expect(deps.invokeAnalysis).toHaveBeenCalledWith({ id: "session-1", userId: "user-1", pipelineVersion: "legacy-retryable" });
  });

  it("retries v64 and future whole-video sessions from their durable recorded stage", async () => {
    const deps = dependencies({
      findDueSessions: jest.fn(async () => [
        { id: "single-call", userId: "user-1", pipelineVersion: "gemini-whole-video-v56-single-call-rep-audit" },
        { id: "writer", userId: "user-2", pipelineVersion: "gemini-whole-video-v57-nonblocking-writer" },
        { id: "current", userId: "user-3", pipelineVersion: "gemini-whole-video-v64-durable-retry" },
        { id: "legacy", userId: "user-2", pipelineVersion: "gemini-whole-video-v55-single-pass-coaching" },
      ]),
    });

    const response = await retryAnalysisHandler(new Request("https://example/retry-analysis", { method: "POST" }), deps);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ processed: 4, succeeded: 4, failed: 0 });
    expect(deps.invokeAnalysis).toHaveBeenCalledTimes(4);
    expect(deps.invokeAnalysis).toHaveBeenCalledWith({ id: "current", userId: "user-3", pipelineVersion: "gemini-whole-video-v64-durable-retry" });
  });
});
