import type { UploadTarget } from "./types";
import { createUploadCoordinator, type UploadCoordinatorDependencies } from "./upload-coordinator";

const target: UploadTarget = {
  sessionId: "session-1",
  signedUrl: "https://storage.example/upload",
  uploadToken: "upload-token",
  path: "user-1/session-1/original.mp4",
};

const recording = {
  localUri: "file:///set.mp4",
  durationMs: 18_000,
  mimeType: "video/mp4",
};

function dependencies(overrides: Partial<UploadCoordinatorDependencies> = {}): UploadCoordinatorDependencies {
  return {
    getAccessToken: jest.fn(async () => "user-jwt"),
    createSession: jest.fn(async () => target),
    uploadVideo: jest.fn(async () => undefined),
    completeUpload: jest.fn(async () => undefined),
    ...overrides,
  };
}

describe("upload coordinator", () => {
  it("reuses one prepared target and completes the upload in order", async () => {
    const deps = dependencies();
    const coordinator = createUploadCoordinator(deps);

    const prepared = coordinator.prepare("previous-1");
    const result = await coordinator.run(recording, "previous-1");

    expect(await prepared).toEqual(target);
    expect(result).toEqual({ sessionId: "session-1" });
    expect(deps.createSession).toHaveBeenCalledTimes(1);
    expect(deps.createSession).toHaveBeenCalledWith("user-jwt", "previous-1");
    expect((deps.uploadVideo as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (deps.completeUpload as jest.Mock).mock.invocationCallOrder[0],
    );
  });

  it("creates a fresh target when background preparation failed", async () => {
    const createSession = jest
      .fn<Promise<UploadTarget>, [string, string | undefined]>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(target);
    const coordinator = createUploadCoordinator(dependencies({ createSession }));

    await expect(coordinator.prepare()).resolves.toBeNull();
    await expect(coordinator.run(recording)).resolves.toEqual({ sessionId: "session-1" });
    expect(createSession).toHaveBeenCalledTimes(2);
  });

  it("retries completion without uploading the saved video twice", async () => {
    const completeUpload = jest
      .fn<Promise<void>, [string, string, number]>()
      .mockRejectedValueOnce(new Error("completion unavailable"))
      .mockResolvedValueOnce(undefined);
    const deps = dependencies({ completeUpload });
    const coordinator = createUploadCoordinator(deps);

    await expect(coordinator.run(recording)).rejects.toThrow("completion unavailable");
    await expect(coordinator.run(recording)).resolves.toEqual({ sessionId: "session-1" });

    expect(deps.uploadVideo).toHaveBeenCalledTimes(1);
    expect(completeUpload).toHaveBeenCalledTimes(2);
  });

  it("clears prepared state only when explicitly reset", async () => {
    const deps = dependencies();
    const coordinator = createUploadCoordinator(deps);

    await coordinator.prepare();
    coordinator.reset();
    await coordinator.prepare();

    expect(deps.createSession).toHaveBeenCalledTimes(2);
  });
});
