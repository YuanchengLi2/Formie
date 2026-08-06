import type { SetDeclaration } from "@/features/analysis/set-declaration";
import type { UploadTarget } from "./types";
import { createUploadCoordinator, type UploadCoordinatorDependencies } from "./upload-coordinator";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const target: UploadTarget = {
  sessionId: "session-1",
  original: {
    signedUrl: "https://storage.example/original",
    uploadToken: "original-token",
    path: "user-1/session-1/original.mp4",
  },
  analysis: {
    signedUrl: "https://storage.example/analysis",
    uploadToken: "analysis-token",
    path: "user-1/session-1/analysis-input.mp4",
  },
  privacySafe: {
    signedUrl: "https://storage.example/privacy",
    uploadToken: "privacy-token",
    path: "user-1/session-1/privacy-safe-upper-body.mp4",
  },
};
const singleTarget: UploadTarget = {
  sessionId: "session-single",
  analysis: {
    signedUrl: "https://storage.example/analysis-single",
    uploadToken: "analysis-single-token",
    path: "user-1/session-single/analysis-input.mp4",
  },
};

const declaration: SetDeclaration = {
  exercise: { source: "catalog" as const, catalogExerciseId: 3, label: "Dumbbell Bench Press" },
  amount: { kind: "reps" as const, value: 8, countScope: "total" as const },
  load: { kind: "known" as const, value: 40, unit: "lb" as const, scope: "per_hand" as const },
  side: "bilateral" as const,
  styles: [],
  focusNote: null,
};

const recording = {
  localUri: "file:///set.mp4",
  durationMs: 12_000,
  mimeType: "video/mp4",
};

function dependencies(overrides: Partial<UploadCoordinatorDependencies> = {}): UploadCoordinatorDependencies {
  return {
    getAccessToken: jest.fn(async () => "user-jwt"),
    createSession: jest.fn(async () => target),
    createRequestId: jest.fn(() => "upload-request-1"),
    uploadVideo: jest.fn(async () => undefined),
    normalizeVideo: jest.fn(async (value) => ({ ...value, localUri: "file:///set-upright.mp4" })),
    normalizePrivacySafeFallback: jest.fn(async (value) => ({ ...value, localUri: "file:///set-upper-body.mp4" })),
    bindLocalRecording: jest.fn(async () => undefined),
    completeUpload: jest.fn(async () => undefined),
    ...overrides,
  };
}

describe("upload coordinator", () => {
  it("makes an explicit single-upload retry idempotent after an ambiguous timeout", () => {
    const source = readFileSync(resolve(__dirname, "analysis-upload-coordinator.ts"), "utf8");
    expect(source).toContain("upsert: true");
  });
  it("rejects recordings beyond 15 seconds before creating or uploading anything", async () => {
    const deps = dependencies();
    const coordinator = createUploadCoordinator(deps);
    await expect(coordinator.run({ ...recording, durationMs: 15_001 }, declaration)).rejects.toThrow("between 3 and 15 seconds");
    expect(deps.createSession).not.toHaveBeenCalled();
    expect(deps.uploadVideo).not.toHaveBeenCalled();
  });

  it("reuses one prepared target and completes the upload in order", async () => {
    const deps = dependencies();
    const coordinator = createUploadCoordinator(deps);

    const result = await coordinator.run(recording, declaration, "previous-1");

    expect(result).toEqual({ sessionId: "session-1", target });
    expect(deps.createSession).toHaveBeenCalledTimes(1);
    expect(deps.createSession).toHaveBeenCalledWith("user-jwt", declaration, "previous-1", "upload-request-1", expect.any(AbortSignal));
    expect((deps.uploadVideo as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (deps.completeUpload as jest.Mock).mock.invocationCallOrder[0],
    );
  });

  it("uses one streamed analysis upload and no original/privacy uploads for the v1 profile", async () => {
    const prepared = { ...recording, localUri: "file:///set-prepared.mp4", byteLength: 4_500_000 };
    const deps = dependencies({
      createSession: jest.fn(async () => singleTarget),
      prepareAnalysisVideo: jest.fn(async () => prepared),
    });
    const coordinator = createUploadCoordinator(deps);

    await coordinator.run(recording, declaration);

    expect(deps.uploadVideo).toHaveBeenCalledTimes(1);
    expect(deps.uploadVideo).toHaveBeenCalledWith(prepared, singleTarget.analysis, expect.any(AbortSignal));
    expect(deps.normalizeVideo).not.toHaveBeenCalled();
    expect(deps.normalizePrivacySafeFallback).not.toHaveBeenCalled();
    expect(deps.completeUpload).toHaveBeenCalledWith("user-jwt", "session-single", 12_000, false, expect.any(AbortSignal), { byteLength: 4_500_000 });
  });

  it("prepares analysis artifacts while the original video uploads", async () => {
    let finishOriginal!: () => void;
    let finishNormalization!: (value: typeof recording) => void;
    const uploadVideo = jest.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finishOriginal = resolve; }))
      .mockResolvedValue(undefined);
    const normalizeVideo = jest.fn(() => new Promise<typeof recording>((resolve) => {
      finishNormalization = resolve;
    }));
    const deps = dependencies({ uploadVideo, normalizeVideo });
    const coordinator = createUploadCoordinator(deps);

    const running = coordinator.run(recording, declaration);
    await new Promise(setImmediate);

    expect(uploadVideo).toHaveBeenCalledWith(recording, target.original, expect.any(AbortSignal));
    expect(normalizeVideo).toHaveBeenCalledWith(recording);

    finishOriginal();
    finishNormalization({ ...recording, localUri: "file:///set-upright.mp4" });
    await running;
  });

  it("publishes every upload substage and exposes the session before uploading bytes", async () => {
    const stages: string[] = [];
    let finishOriginal!: () => void;
    const uploadVideo = jest.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finishOriginal = resolve; }))
      .mockResolvedValueOnce(undefined);
    const coordinator = createUploadCoordinator(dependencies({ uploadVideo }));
    coordinator.subscribe((progress) => stages.push(progress.substage));

    const running = coordinator.run(recording, declaration);
    await new Promise(setImmediate);

    expect(stages).toEqual(["creating_session", "uploading_original", "normalizing"]);
    expect(coordinator.currentProgress()).toMatchObject({
      substage: "normalizing",
      target: { sessionId: "session-1" },
    });

    finishOriginal();
    await running;
    expect(stages).toEqual([
      "creating_session",
      "uploading_original",
      "normalizing",
      "uploading_analysis",
      "uploading_analysis",
      "finalizing",
    ]);
  });

  it("lets a remounted subscriber reattach to the same active upload", async () => {
    let finishOriginal!: () => void;
    const uploadVideo = jest.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finishOriginal = resolve; }))
      .mockResolvedValueOnce(undefined);
    const deps = dependencies({ uploadVideo });
    const coordinator = createUploadCoordinator(deps);
    const firstRun = coordinator.run(recording, declaration);
    await new Promise(setImmediate);

    const observed: string[] = [];
    coordinator.subscribe((progress) => observed.push(progress.substage));
    const secondRun = coordinator.run(recording, declaration);

    expect(observed).toEqual(["normalizing"]);
    expect(deps.createSession).toHaveBeenCalledTimes(1);
    finishOriginal();
    await expect(Promise.all([firstRun, secondRun])).resolves.toHaveLength(2);
  });

  it("waits for the upright full-video upload before completing the single-video session", async () => {
    let finishVideo!: () => void;
    const uploadVideo = jest
      .fn<Promise<void>, [typeof recording, UploadTarget["original"]]>()
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finishVideo = resolve; }));
    const completeUpload = jest.fn(async () => undefined);
    const deps = dependencies({ uploadVideo, completeUpload });
    const coordinator = createUploadCoordinator(deps);

    const running = coordinator.run(recording, declaration);
    expect(completeUpload).not.toHaveBeenCalled();
    await new Promise(setImmediate);
    finishVideo();
    await running;

    expect(uploadVideo).toHaveBeenNthCalledWith(1, recording, target.original, expect.any(AbortSignal));
    expect(uploadVideo).toHaveBeenNthCalledWith(2, { ...recording, localUri: "file:///set-upright.mp4" }, target.analysis, expect.any(AbortSignal));
    expect(completeUpload).toHaveBeenCalledWith("user-jwt", "session-1", 12_000, true, expect.any(AbortSignal));
    expect(deps.bindLocalRecording).toHaveBeenCalledWith("session-1", recording);
  });

  it("uploads the untouched original plus one normalized full-length upright video", async () => {
    const normalized = { ...recording, localUri: "file:///set-upright.mp4" };
    const normalizeVideo = jest.fn(async () => normalized);
    const deps = {
      ...dependencies(),
      normalizeVideo,
    } as UploadCoordinatorDependencies & {
      normalizeVideo: typeof normalizeVideo;
    };
    const coordinator = createUploadCoordinator(deps);

    await coordinator.run(recording, declaration);

    expect(deps.uploadVideo).toHaveBeenCalledTimes(3);
    expect(deps.uploadVideo).toHaveBeenNthCalledWith(1, recording, target.original, expect.any(AbortSignal));
    expect(deps.uploadVideo).toHaveBeenNthCalledWith(2, normalized, target.analysis, expect.any(AbortSignal));
    expect(deps.uploadVideo).toHaveBeenNthCalledWith(3, { ...recording, localUri: "file:///set-upper-body.mp4" }, target.privacySafe, expect.any(AbortSignal));
    expect(normalizeVideo).toHaveBeenCalledWith(recording);
    expect(deps.completeUpload).toHaveBeenCalledWith("user-jwt", "session-1", 12_000, true, expect.any(AbortSignal));
  });

  it("retries session creation with one idempotency key", async () => {
    const createSession = jest
      .fn<Promise<UploadTarget>, [string, SetDeclaration, string | undefined, string, AbortSignal]>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(target);
    const coordinator = createUploadCoordinator(dependencies({ createSession }));

    await expect(coordinator.run(recording, declaration)).resolves.toEqual({ sessionId: "session-1", target });
    expect(createSession).toHaveBeenCalledTimes(2);
    expect(createSession.mock.calls[0][3]).toBe("upload-request-1");
    expect(createSession.mock.calls[1][3]).toBe("upload-request-1");
  });

  it("retries completion without uploading the saved video twice", async () => {
    const completeUpload = jest
      .fn<Promise<void>, [string, string, number, boolean, AbortSignal]>()
      .mockRejectedValueOnce(new Error("completion unavailable"))
      .mockResolvedValueOnce(undefined);
    const deps = dependencies({ completeUpload });
    const coordinator = createUploadCoordinator(deps);

    await expect(coordinator.run(recording, declaration)).resolves.toEqual({ sessionId: "session-1", target });

    expect(deps.uploadVideo).toHaveBeenCalledTimes(3);
    expect(completeUpload).toHaveBeenCalledTimes(2);
  });

  it("clears prepared state only when explicitly reset", async () => {
    const deps = dependencies();
    const coordinator = createUploadCoordinator(deps);

    await coordinator.run(recording, declaration);
    coordinator.reset();
    await coordinator.run(recording, declaration);

    expect(deps.createSession).toHaveBeenCalledTimes(2);
  });

  it("releases one reserved credit exactly once when cancellation is repeated", async () => {
    const cancelReservation = jest.fn(async () => undefined);
    let finishUpload!: () => void;
    const uploadVideo = jest.fn(() => new Promise<void>((resolve) => { finishUpload = resolve; }));
    const coordinator = createUploadCoordinator(dependencies({
      createSession: jest.fn(async () => ({ ...singleTarget, reservationId: "reservation-1" })),
      prepareAnalysisVideo: jest.fn(async () => ({ ...recording, byteLength: 4_500_000 })),
      uploadVideo,
      cancelReservation,
    }));
    const running = coordinator.run(recording, declaration).catch(() => undefined);
    await new Promise(setImmediate);

    await Promise.all([coordinator.cancelReservation(), coordinator.cancelReservation()]);
    expect(cancelReservation).toHaveBeenCalledTimes(1);
    finishUpload();
    await running;
  });

  it("releases a reserved credit after a terminal pre-completion failure", async () => {
    const cancelReservation = jest.fn(async () => undefined);
    const createSession = jest.fn()
      .mockResolvedValueOnce({ ...singleTarget, sessionId: "failed-session", reservationId: "failed-reservation" })
      .mockResolvedValueOnce({ ...singleTarget, sessionId: "retry-session", reservationId: "retry-reservation" });
    const uploadVideo = jest.fn()
      .mockRejectedValueOnce(new Error("upload failed"))
      .mockResolvedValueOnce(undefined);
    const coordinator = createUploadCoordinator(dependencies({
      createSession,
      prepareAnalysisVideo: jest.fn(async () => ({ ...recording, byteLength: 4_500_000 })),
      uploadVideo,
      cancelReservation,
    }));

    await expect(coordinator.run(recording, declaration)).rejects.toThrow("upload failed");
    expect(cancelReservation).toHaveBeenCalledTimes(1);
    expect(cancelReservation).toHaveBeenCalledWith("failed-reservation");

    await expect(coordinator.run(recording, declaration)).resolves.toMatchObject({ sessionId: "retry-session" });
    expect(createSession).toHaveBeenCalledTimes(2);
    expect(cancelReservation).toHaveBeenCalledTimes(1);
  });

  it("does not reuse a failed session for a different declaration", async () => {
    const changed = { ...declaration, amount: { ...declaration.amount, value: 10 } };
    const completeUpload = jest.fn()
      .mockRejectedValueOnce(new Error("completion unavailable"))
      .mockRejectedValueOnce(new Error("completion unavailable"))
      .mockResolvedValue(undefined);
    const deps = dependencies({ completeUpload });
    const coordinator = createUploadCoordinator(deps);

    await expect(coordinator.run(recording, declaration)).rejects.toThrow();
    await expect(coordinator.run(recording, changed)).resolves.toEqual({ sessionId: "session-1", target });
    expect(deps.createSession).toHaveBeenCalledTimes(2);
  });
});
