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
      request({
        sessionId: "session-1",
        durationMs: 18_500,
        captureOrientation: "landscapeLeft",
        cameraFacing: "back",
        cameraLens: "wideAngleCamera",
      }),
      deps,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ processing: true });
    expect(deps.markProcessing).toHaveBeenCalledWith({
      sessionId: "session-1",
      userId: "user-1",
      videoPath: "user-1/session-1/original.mp4",
      durationMs: 18_500,
      captureOrientation: "landscapeLeft",
      cameraFacing: "back",
      cameraLens: "wideAngleCamera",
      requestedFps: 24,
    });
  });

  it("rejects unsupported capture metadata", async () => {
    const deps = dependencies();
    const response = await completeUploadHandler(
      request({ sessionId: "session-1", durationMs: 2_999, captureOrientation: "upsideways", cameraFacing: "back" }),
      deps,
    );

    expect(response.status).toBe(400);
    expect(deps.markProcessing).not.toHaveBeenCalled();
  });

  it("requires an owned session and uploaded storage object", async () => {
    const missingSession = dependencies({ findSession: jest.fn(async () => null) });
    const notFound = await completeUploadHandler(
      request({ sessionId: "missing", durationMs: 10_000, captureOrientation: "portraitUp", cameraFacing: "front" }),
      missingSession,
    );
    expect(notFound.status).toBe(404);

    const missingVideo = dependencies({ videoExists: jest.fn(async () => false) });
    const conflict = await completeUploadHandler(
      request({ sessionId: "session-1", durationMs: 10_000, captureOrientation: "portraitUp", cameraFacing: "front" }),
      missingVideo,
    );
    expect(conflict.status).toBe(409);
  });
});
