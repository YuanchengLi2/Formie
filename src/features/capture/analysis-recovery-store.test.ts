import type { SetDeclaration } from "@/features/analysis/set-declaration";
import type { RecordedSet } from "./types";

import { createAnalysisRecoveryStore, recoveryCaptureEvent, recoveryDestination, type AnalysisRecoveryAdapter } from "./analysis-recovery-store";

const recording: RecordedSet = { localUri: "file:///documents/formie-recordings/set.mp4", durationMs: 12_000, mimeType: "video/mp4", byteLength: 4_500_000 };
const declaration: SetDeclaration = {
  exercise: { source: "custom", catalogExerciseId: null, label: "Back Squat" },
  amount: { kind: "reps", value: 5, countScope: "total" },
  load: { kind: "known", value: 135, unit: "lb", scope: "total" },
  side: "bilateral",
  styles: [],
  focusNote: null,
};

function adapter(initial: string | null = null): AnalysisRecoveryAdapter & { value: () => string | null } {
  let stored = initial;
  return {
    read: jest.fn(async () => stored),
    write: jest.fn(async (value) => { stored = value; }),
    remove: jest.fn(async () => { stored = null; }),
    value: () => stored,
  };
}

describe("analysis recovery journal", () => {
  it("persists the durable recording and idempotency key before upload", async () => {
    const storage = adapter();
    const store = createAnalysisRecoveryStore(storage);
    await store.saveUpload({ userId: "user-1", recording, declaration, previousSessionId: null, clientRequestId: "upload-request-1", sessionId: null });

    await expect(createAnalysisRecoveryStore(storage).load()).resolves.toMatchObject({
      phase: "uploading",
      userId: "user-1",
      clientRequestId: "upload-request-1",
      recording,
      declaration,
    });
  });

  it("moves the same operation into processing and restores its analysis route", async () => {
    const storage = adapter();
    const store = createAnalysisRecoveryStore(storage);
    await store.saveUpload({ userId: "user-1", recording, declaration, previousSessionId: null, clientRequestId: "upload-request-1", sessionId: "session-1" });
    await store.markProcessing("user-1", "session-1");
    const recovered = await store.load();

    expect(recovered).toEqual({ version: 1, phase: "processing", userId: "user-1", sessionId: "session-1" });
    expect(recoveryDestination(recovered, "user-1")).toBe("/analysis/session-1");
    expect(recoveryCaptureEvent(recovered, "user-1")).toEqual({ type: "processing_recovered", sessionId: "session-1" });
    expect(recoveryDestination(recovered, "another-user")).toBeNull();
  });

  it("keeps a failed upload recoverable for an explicit retry and rejects corrupt journals", async () => {
    const storage = adapter();
    const store = createAnalysisRecoveryStore(storage);
    await store.saveUpload({ userId: "user-1", recording, declaration, previousSessionId: null, clientRequestId: "upload-request-1", sessionId: "session-1" });
    await store.markUploadFailed("Connection lost");
    await expect(store.load()).resolves.toMatchObject({ phase: "failed", error: "Connection lost", recording });
    expect(recoveryCaptureEvent(await store.load(), "user-1")).toMatchObject({
      type: "upload_recovered",
      clientRequestId: "upload-request-1",
      sessionId: "session-1",
      error: "Connection lost",
    });

    const corrupt = adapter(JSON.stringify({ version: 1, phase: "uploading", userId: "user-1" }));
    await expect(createAnalysisRecoveryStore(corrupt).load()).resolves.toBeNull();
    expect(corrupt.remove).toHaveBeenCalledTimes(1);
  });
});
