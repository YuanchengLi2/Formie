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
    wait: jest.fn(async () => undefined),
    ...overrides,
  };
}

describe("completeUploadHandler", () => {
  it("identifies the active upload contract on every response", async () => {
    const response = await completeUploadHandler(
      request({
        sessionId: "session-1",
        durationMs: 12_000,
        analysisInput: { kind: "capture_ready_video", durationPreserved: true, byteLength: 4_500_000 },
      }),
      dependencies(),
    );

    expect(response.headers.get("X-Formie-Upload-Contract")).toBe("single-analysis-v1");
  });

  it("finalizes a single capture-ready analysis video without an original upload", async () => {
    const deps = dependencies({
      findSession: jest.fn(async () => ({ id: "session-1", videoPath: null })),
      videoExists: jest.fn(async (path) => path.endsWith("/analysis-input.mp4")),
    });

    const response = await completeUploadHandler(
      request({
        sessionId: "session-1",
        durationMs: 12_000,
        analysisInput: { kind: "capture_ready_video", durationPreserved: true, byteLength: 4_500_000 },
      }),
      deps,
    );

    expect(response.status).toBe(200);
    expect(deps.markProcessing).toHaveBeenCalledWith(expect.objectContaining({
      videoPath: "user-1/session-1/analysis-input.mp4",
      analysisVideoPath: "user-1/session-1/analysis-input.mp4",
      analysisInputStrategy: "capture_ready_video",
    }));
  });

  it("queues the legacy analyzer without creating a v49 run", async () => {
    const deps = dependencies();

    const response = await completeUploadHandler(request({ sessionId: "session-1", durationMs: 12_000 }), deps);

    expect(response.status).toBe(200);
    expect(deps.markProcessing).toHaveBeenCalled();
  });

  it("accepts a capture-ready video larger than the old inline Gemini payload limit", async () => {
    const deps = dependencies({
      findSession: jest.fn(async () => ({ id: "session-1", videoPath: null })),
      videoExists: jest.fn(async (path) => path.endsWith("/analysis-input.mp4")),
    });

    const response = await completeUploadHandler(
      request({
        sessionId: "session-1",
        durationMs: 12_000,
        analysisInput: { kind: "capture_ready_video", durationPreserved: true, byteLength: 25_000_000 },
      }),
      deps,
    );

    expect(response.status).toBe(200);
    expect(deps.markProcessing).toHaveBeenCalled();
  });

  it("marks an owned uploaded video ready for the video-only criteria pipeline", async () => {
    const deps = dependencies();
    const response = await completeUploadHandler(
      request({ sessionId: "session-1", durationMs: 12_500 }),
      deps,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ processing: true });
    expect(deps.markProcessing).toHaveBeenCalledWith({
      sessionId: "session-1",
      userId: "user-1",
      videoPath: "user-1/session-1/original.mp4",
      durationMs: 12_500,
      analysisInputStrategy: "video",
    });
  });

  it("rejects retired analysis artifact metadata", async () => {
    const deps = dependencies();
    const response = await completeUploadHandler(request({
      sessionId: "session-1", durationMs: 12_500, poseSummary: { version: 3 },
    }), deps);
    expect(response.status).toBe(400);
    expect(deps.markProcessing).not.toHaveBeenCalled();
  });

  it("accepts a validated analysis crop only after both private videos are visible", async () => {
    const deps = dependencies();
    const response = await completeUploadHandler(request({
      sessionId: "session-1",
      durationMs: 14_000,
      preprocessing: {
        applied: true,
        sourceStartMs: 2_000,
        sourceEndMs: 12_000,
        confidence: 0.94,
          crop: { x: 0.08, y: 0.08, width: 0.84, height: 0.84 },
      },
    }), deps);

    expect(response.status).toBe(200);
    expect(deps.videoExists).toHaveBeenCalledWith("user-1/session-1/original.mp4");
    expect(deps.videoExists).toHaveBeenCalledWith("user-1/session-1/analysis-input.mp4");
    expect(deps.markProcessing).toHaveBeenCalledWith({
      sessionId: "session-1",
      userId: "user-1",
      videoPath: "user-1/session-1/original.mp4",
      durationMs: 14_000,
      analysisInputStrategy: "trimmed_crop",
      analysisVideoPath: "user-1/session-1/analysis-input.mp4",
      analysisDurationMs: 10_000,
      sourceStartMs: 2_000,
      sourceEndMs: 12_000,
        crop: { x: 0.08, y: 0.08, width: 0.84, height: 0.84 },
      preprocessingConfidence: 0.94,
    });
  });

  it("accepts an upright full-length analysis artifact without trim or crop metadata", async () => {
    const deps = dependencies();
    const response = await completeUploadHandler(request({
      sessionId: "session-1",
      durationMs: 14_000,
      analysisInput: {
        kind: "upright_video",
        durationPreserved: true,
      },
    }), deps);

    expect(response.status).toBe(200);
    expect(deps.videoExists).toHaveBeenCalledWith("user-1/session-1/original.mp4");
    expect(deps.videoExists).toHaveBeenCalledWith("user-1/session-1/analysis-input.mp4");
    expect(deps.markProcessing).toHaveBeenCalledWith({
      sessionId: "session-1",
      userId: "user-1",
      videoPath: "user-1/session-1/original.mp4",
      durationMs: 14_000,
      analysisInputStrategy: "upright_video",
      analysisVideoPath: "user-1/session-1/analysis-input.mp4",
      analysisDurationMs: 14_000,
      sourceStartMs: 0,
      sourceEndMs: 14_000,
      crop: null,
      preprocessingConfidence: 1,
    });
  });

  it("persists an uploaded privacy-safe upper-body fallback without replacing the full analysis video", async () => {
    const deps = dependencies();
    const response = await completeUploadHandler(request({
      sessionId: "session-1",
      durationMs: 14_000,
      analysisInput: { kind: "upright_video", durationPreserved: true },
      privacySafeFallback: { kind: "upper_body", durationPreserved: true },
    }), deps);

    expect(response.status).toBe(200);
    expect(deps.videoExists).toHaveBeenCalledWith("user-1/session-1/privacy-safe-upper-body.mp4");
    expect(deps.markProcessing).toHaveBeenCalledWith(expect.objectContaining({
      analysisVideoPath: "user-1/session-1/analysis-input.mp4",
      analysisFallbackVideoPath: "user-1/session-1/privacy-safe-upper-body.mp4",
    }));
  });

  it("rejects a crop that removes too much of the recording or frame", async () => {
    const deps = dependencies();
    const response = await completeUploadHandler(request({
      sessionId: "session-1",
      durationMs: 14_000,
      preprocessing: {
        applied: true,
        sourceStartMs: 10_000,
        sourceEndMs: 14_000,
        confidence: 0.99,
        crop: { x: 0.3, y: 0.2, width: 0.4, height: 0.5 },
      },
    }), deps);

    expect(response.status).toBe(400);
    expect(deps.markProcessing).not.toHaveBeenCalled();
  });

  it("rejects an equipment-unsafe crop even when its time window is valid", async () => {
    const deps = dependencies();
    const response = await completeUploadHandler(request({
      sessionId: "session-1",
      durationMs: 14_000,
      preprocessing: {
        applied: true,
        sourceStartMs: 2_000,
        sourceEndMs: 12_000,
        confidence: 0.99,
        crop: { x: 0.12, y: 0.08, width: 0.76, height: 0.84 },
      },
    }), deps);

    expect(response.status).toBe(400);
    expect(deps.markProcessing).not.toHaveBeenCalled();
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

  it("accepts a complete fifteen-second set and rejects longer uploads", async () => {
    const deps = dependencies();
    const response = await completeUploadHandler(
      request({ sessionId: "session-1", durationMs: 15_000 }),
      deps,
    );

    expect(response.status).toBe(200);
    expect(deps.markProcessing).toHaveBeenCalledWith(expect.objectContaining({ durationMs: 15_000 }));

    const tooLong = await completeUploadHandler(
      request({ sessionId: "session-1", durationMs: 15_001 }),
      dependencies(),
    );
    expect(tooLong.status).toBe(400);
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

  it("waits briefly for a completed signed upload to become visible", async () => {
    const videoExists = jest
      .fn<Promise<boolean>, [string]>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const deps = dependencies({ videoExists });

    const response = await completeUploadHandler(
      request({ sessionId: "session-1", durationMs: 12_500 }),
      deps,
    );

    expect(response.status).toBe(200);
    expect(videoExists).toHaveBeenCalledTimes(3);
    expect(deps.markProcessing).toHaveBeenCalledTimes(1);
  });
});
