import { completeUploadHandler, type CompleteUploadDependencies } from "./handler";

function request(body: unknown) {
  return new Request("https://example.test/complete-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function dependencies(overrides: Partial<CompleteUploadDependencies> = {}): CompleteUploadDependencies {
  return {
    authenticate: jest.fn(async () => "user-1"),
    findSession: jest.fn(async () => ({ id: "session-1", videoPath: null })),
    videoExists: jest.fn(async () => true),
    markProcessing: jest.fn(async () => undefined),
    ...overrides,
  };
}

describe("completeUploadHandler", () => {
  it("marks an owned uploaded video ready for Gemini without queueing a job", async () => {
    const deps = dependencies();
    const response = await completeUploadHandler(
      request({ sessionId: "session-1", durationMs: 18_500 }),
      deps,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ processing: true });
    expect(deps.markProcessing).toHaveBeenCalledWith({
      sessionId: "session-1",
      userId: "user-1",
      videoPath: "user-1/session-1/original.mp4",
      durationMs: 18_500,
      requestedFps: 24,
      poseSummary: null,
    });
  });

  it("rejects an unsupported recording duration", async () => {
    const deps = dependencies();
    const response = await completeUploadHandler(
      request({ sessionId: "session-1", durationMs: 2_999 }),
      deps,
    );

    expect(response.status).toBe(400);
    expect(deps.markProcessing).not.toHaveBeenCalled();
  });

  it("validates and stores an optional MoveNet Thunder summary", async () => {
    const deps = dependencies();
    const poseSummary = {
      version: 1,
      model: "MoveNet.SinglePose.Thunder",
      durationMs: 10_000,
      requestedFrames: 40,
      framesAnalyzed: 36,
      sampleFps: 3.6,
      overallVisibility: 0.88,
      seriesColumns: ["timeMs", "confidence", "leftWristX"],
      series: [[0, 0.9, 0.2], [250, 0.91, 0.21], [500, 0.92, 0.23], [750, 0.9, 0.25]],
    };
    const response = await completeUploadHandler(request({ sessionId: "session-1", durationMs: 10_000, poseSummary }), deps);

    expect(response.status).toBe(200);
    expect(deps.markProcessing).toHaveBeenCalledWith(expect.objectContaining({ poseSummary }));
  });

  it("rejects malformed pose metadata without blocking uploads that omit it", async () => {
    const deps = dependencies();
    const response = await completeUploadHandler(request({ sessionId: "session-1", durationMs: 10_000, poseSummary: { model: "fake" } }), deps);
    expect(response.status).toBe(400);
    expect(deps.markProcessing).not.toHaveBeenCalled();
  });

  it("requires an owned session and uploaded storage object", async () => {
    const missingSession = dependencies({ findSession: jest.fn(async () => null) });
    const notFound = await completeUploadHandler(
      request({ sessionId: "missing", durationMs: 10_000 }),
      missingSession,
    );
    expect(notFound.status).toBe(404);

    const missingVideo = dependencies({ videoExists: jest.fn(async () => false) });
    const conflict = await completeUploadHandler(
      request({ sessionId: "session-1", durationMs: 10_000 }),
      missingVideo,
    );
    expect(conflict.status).toBe(409);
  });
});
