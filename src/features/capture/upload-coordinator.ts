import type { RecordedSet, UploadTarget } from "./types";

export type UploadCoordinatorDependencies = {
  getAccessToken: () => Promise<string>;
  createSession: (accessToken: string, previousSessionId?: string) => Promise<UploadTarget>;
  uploadVideo: (recording: RecordedSet, target: UploadTarget) => Promise<void>;
  completeUpload: (accessToken: string, sessionId: string, durationMs: number) => Promise<void>;
};

export function createUploadCoordinator(dependencies: UploadCoordinatorDependencies) {
  let preparedTarget: Promise<UploadTarget | null> | null = null;
  let currentTarget: UploadTarget | null = null;
  let uploaded = false;
  let activeRun: Promise<{ sessionId: string }> | null = null;

  const createTarget = async (previousSessionId?: string): Promise<UploadTarget> => {
    const accessToken = await dependencies.getAccessToken();
    return dependencies.createSession(accessToken, previousSessionId);
  };

  const prepare = (previousSessionId?: string): Promise<UploadTarget | null> => {
    if (currentTarget) return Promise.resolve(currentTarget);
    if (!preparedTarget) {
      preparedTarget = createTarget(previousSessionId)
        .then((target) => {
          currentTarget = target;
          return target;
        })
        .catch(() => null);
    }
    return preparedTarget;
  };

  const reset = () => {
    preparedTarget = null;
    currentTarget = null;
    uploaded = false;
    activeRun = null;
  };

  const run = (recording: RecordedSet, previousSessionId?: string): Promise<{ sessionId: string }> => {
    if (activeRun) return activeRun;

    const operation = (async () => {
      let target = currentTarget ?? await prepare(previousSessionId);
      if (!target) {
        target = await createTarget(previousSessionId);
        currentTarget = target;
      }

      if (!uploaded) {
        await dependencies.uploadVideo(recording, target);
        uploaded = true;
      }

      const accessToken = await dependencies.getAccessToken();
      await dependencies.completeUpload(accessToken, target.sessionId, recording.durationMs);
      const result = { sessionId: target.sessionId };
      reset();
      return result;
    })();

    activeRun = operation;
    void operation.finally(() => {
      if (activeRun === operation) activeRun = null;
    }).catch(() => undefined);
    return operation;
  };

  return { prepare, reset, run };
}
