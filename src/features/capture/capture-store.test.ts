import { captureReducer, initialCaptureState } from "./capture-store";
import type { CaptureState } from "./types";

describe("capture state", () => {
  it("moves through countdown, recording, local save, upload, and processing", () => {
    let state = captureReducer(initialCaptureState, { type: "begin_countdown", previousSessionId: "prior-1" });
    expect(state).toMatchObject({ phase: "countingDown", countdown: 10, previousSessionId: "prior-1" });

    for (let count = 0; count < 10; count += 1) state = captureReducer(state, { type: "countdown_tick" });
    expect(state.countdown).toBe(0);

    state = captureReducer(state, { type: "recording_started", startedAt: 1_000 });
    state = captureReducer(state, {
      type: "recording_finished",
      recording: { localUri: "file:///set.mp4", durationMs: 18_000, mimeType: "video/mp4", captureOrientation: "landscapeLeft", cameraFacing: "back", cameraLens: "wide" },
    });
    state = captureReducer(state, { type: "upload_started" });
    state = captureReducer(state, { type: "processing", sessionId: "session-1" });

    expect(state).toMatchObject({
      phase: "processing",
      sessionId: "session-1",
      recording: { localUri: "file:///set.mp4", durationMs: 18_000 },
    });
  });

  it("preserves the local recording through an upload failure and retry", () => {
    let state: CaptureState = {
      ...initialCaptureState,
      phase: "recorded" as const,
      recording: { localUri: "file:///set.mp4", durationMs: 12_000, mimeType: "video/mp4", captureOrientation: "portraitUp", cameraFacing: "back", cameraLens: null },
    };

    state = captureReducer(state, { type: "upload_started" });
    state = captureReducer(state, {
      type: "upload_target_created",
      target: {
        sessionId: "session-1",
        signedUrl: "https://storage.example/upload",
        uploadToken: "upload-token",
        path: "user/session-1/original.mp4",
      },
    });
    state = captureReducer(state, { type: "upload_failed", message: "Connection lost" });

    expect(state.phase).toBe("error");
    expect(state.recording?.localUri).toBe("file:///set.mp4");
    expect(state.uploadTarget?.sessionId).toBe("session-1");

    state = captureReducer(state, { type: "retry_upload" });
    expect(state).toMatchObject({
      phase: "uploading",
      error: null,
      recording: { localUri: "file:///set.mp4" },
      uploadTarget: { sessionId: "session-1" },
    });
  });

  it("prepares the signed upload target during the countdown", () => {
    let state = captureReducer(initialCaptureState, { type: "begin_countdown" });
    state = captureReducer(state, {
      type: "upload_target_created",
      target: {
        sessionId: "session-prepared",
        signedUrl: "https://storage.example/upload",
        uploadToken: "upload-token",
        path: "user/session-prepared/original.mp4",
      },
    });

    expect(state).toMatchObject({
      phase: "countingDown",
      sessionId: "session-prepared",
      uploadTarget: { sessionId: "session-prepared" },
    });
  });

  it("rejects impossible transitions", () => {
    expect(() => captureReducer(initialCaptureState, { type: "recording_started", startedAt: 1_000 })).toThrow(
      "Cannot start recording from idle",
    );
  });

  it("distinguishes a camera failure from a saved upload failure", () => {
    const recordingState: CaptureState = {
      ...initialCaptureState,
      phase: "recording",
      startedAt: 1_000,
    };
    const failed = captureReducer(recordingState, { type: "recording_failed", message: "Camera stopped" });
    expect(failed).toMatchObject({ phase: "error", recording: null, error: "Camera stopped" });
  });
});
