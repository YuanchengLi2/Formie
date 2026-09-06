import type { SetDeclaration } from "@/features/analysis/set-declaration";
import { withRequestDeadline } from "@/lib/request-deadline";

import { captureVideoSettings } from "./video-settings";
import type {
  RecordedSet,
  UploadArtifactTarget,
  UploadProgress,
  UploadSubstage,
  UploadTarget,
} from "./types";

const NETWORK_ATTEMPTS = 2;
const NETWORK_STEP_TIMEOUT_MS = 45_000;
const MAX_UPLOAD_TIMEOUT_MS = 120_000;
const UPLOAD_BYTES_PER_SECOND_FLOOR = 131_072;
const UPLOAD_TIMEOUT_OVERHEAD_MS = 15_000;

export function uploadDeadlineMs(byteLength: number | undefined): number {
  if (typeof byteLength !== "number" || !Number.isFinite(byteLength) || byteLength <= 0) return NETWORK_STEP_TIMEOUT_MS;
  const estimated = Math.ceil(byteLength / UPLOAD_BYTES_PER_SECOND_FLOOR) * 1_000 + UPLOAD_TIMEOUT_OVERHEAD_MS;
  return Math.min(MAX_UPLOAD_TIMEOUT_MS, Math.max(NETWORK_STEP_TIMEOUT_MS, estimated));
}

export type UploadCoordinatorDependencies = {
  getAccessToken: () => Promise<string>;
  createRequestId: () => string;
  createSession: (
    accessToken: string,
    declaration: SetDeclaration,
    previousSessionId: string | undefined,
    clientRequestId: string,
    signal: AbortSignal,
  ) => Promise<UploadTarget>;
  uploadVideo: (recording: RecordedSet, target: UploadArtifactTarget, signal: AbortSignal) => Promise<void>;
  normalizeVideo: (recording: RecordedSet) => Promise<RecordedSet>;
  prepareAnalysisVideo?: (recording: RecordedSet) => Promise<RecordedSet>;
  normalizePrivacySafeFallback: (recording: RecordedSet) => Promise<RecordedSet>;
  bindLocalRecording: (sessionId: string, recording: RecordedSet) => Promise<void>;
  completeUpload: (accessToken: string, sessionId: string, attemptId: string | undefined, durationMs: number, hasPrivacySafeFallback: boolean, signal: AbortSignal, metadata?: { byteLength?: number }) => Promise<void>;
  cancelUpload?: (input: { sessionId: string; reservationId?: string; reason: "upload_failed" | "user_discarded" }) => Promise<void>;
  onFailure?: (input: { error: unknown; sessionId: string | null }) => void;
  onCancelled?: (input: { sessionId: string | null }) => void;
};

async function retryNetworkStep<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs = NETWORK_STEP_TIMEOUT_MS,
  cancellation?: { requested: () => boolean; controllers: Set<AbortController> },
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < NETWORK_ATTEMPTS; attempt += 1) {
    if (cancellation?.requested()) throw Object.assign(new Error("Upload cancelled"), { name: "AbortError" });
    const controller = new AbortController();
    cancellation?.controllers.add(controller);
    try {
      return await withRequestDeadline(operation, timeoutMs, controller.signal);
    } catch (error) {
      if (cancellation?.requested()) throw Object.assign(new Error("Upload cancelled"), { name: "AbortError" });
      lastError = error;
    } finally {
      cancellation?.controllers.delete(controller);
    }
  }
  throw lastError;
}

export function createUploadCoordinator(dependencies: UploadCoordinatorDependencies) {
  let currentTarget: UploadTarget | null = null;
  let originalUploaded = false;
  let analysisUploaded = false;
  let privacySafeUploaded = false;
  let localRecordingBound = false;
  let normalizedRecording: RecordedSet | null = null;
  let privacySafeRecording: RecordedSet | null = null;
  let declarationKey: string | null = null;
  let clientRequestId: string | null = null;
  let activeRun: Promise<{ sessionId: string; target: UploadTarget }> | null = null;
  let cancellation: Promise<void> | null = null;
  let userDiscarded = false;
  const activeNetworkControllers = new Set<AbortController>();
  let progress: UploadProgress | null = null;
  const listeners = new Set<(nextProgress: UploadProgress) => void>();

  const emit = (substage: UploadSubstage, target: UploadTarget | null = currentTarget) => {
    progress = { substage, target };
    listeners.forEach((listener) => listener(progress as UploadProgress));
  };

  const clear = () => {
    currentTarget = null;
    originalUploaded = false;
    analysisUploaded = false;
    privacySafeUploaded = false;
    localRecordingBound = false;
    normalizedRecording = null;
    privacySafeRecording = null;
    declarationKey = null;
    clientRequestId = null;
    progress = null;
  };

  const reset = () => {
    clear();
    activeRun = null;
  };

  const subscribe = (listener: (nextProgress: UploadProgress) => void) => {
    listeners.add(listener);
    if (progress) listener(progress);
    return () => listeners.delete(listener);
  };

  const run = (
    recording: RecordedSet,
    declaration: SetDeclaration,
    previousSessionId?: string,
    recovery?: { clientRequestId: string },
  ): Promise<{ sessionId: string; target: UploadTarget }> => {
    if (activeRun) return activeRun;
    userDiscarded = false;
    const nextDeclarationKey = JSON.stringify({ declaration, previousSessionId: previousSessionId ?? null });
    if (declarationKey !== null && declarationKey !== nextDeclarationKey) clear();
    if (!clientRequestId) clientRequestId = recovery?.clientRequestId ?? dependencies.createRequestId();
    const requestId = clientRequestId;
    const networkStep = <T>(operation: (signal: AbortSignal) => Promise<T>, timeoutMs?: number) => retryNetworkStep(
      operation,
      timeoutMs,
      { requested: () => userDiscarded, controllers: activeNetworkControllers },
    );

    const operation = (async () => {
      if (!Number.isInteger(recording.durationMs) || recording.durationMs < captureVideoSettings.minimumDurationMs || recording.durationMs > captureVideoSettings.maxDurationSeconds * 1_000) {
        throw new Error("Recordings must be between 3 and 15 seconds.");
      }

      if (!currentTarget) {
        emit("creating_session", null);
        const accessToken = await dependencies.getAccessToken();
        currentTarget = await networkStep((signal) => dependencies.createSession(
          accessToken,
          declaration,
          previousSessionId,
          requestId,
          signal,
        ));
        declarationKey = nextDeclarationKey;
      }
      const target = currentTarget;
      if (!localRecordingBound) {
        await dependencies.bindLocalRecording(target.sessionId, recording);
        localRecordingBound = true;
      }

      if (!target.original) {
        if (!normalizedRecording) {
          emit("normalizing", target);
          normalizedRecording = await (dependencies.prepareAnalysisVideo ?? dependencies.normalizeVideo)(recording);
        }
        emit("uploading_video", target);
        await networkStep(
          (signal) => dependencies.uploadVideo(normalizedRecording as RecordedSet, target.analysis, signal),
          uploadDeadlineMs(normalizedRecording?.byteLength),
        );
        emit("finalizing", target);
        const accessToken = await dependencies.getAccessToken();
        await networkStep((signal) => dependencies.completeUpload(
          accessToken,
          target.sessionId,
          target.attemptId,
          recording.durationMs,
          false,
          signal,
          { byteLength: normalizedRecording?.byteLength },
        ));
        const result = { sessionId: target.sessionId, target };
        clear();
        return result;
      }

      const preparationTasks: Promise<void>[] = [];
      const originalTarget = target.original;
      if (!originalUploaded) {
        emit("uploading_original", target);
        preparationTasks.push(
          networkStep((signal) => dependencies.uploadVideo(recording, originalTarget as UploadArtifactTarget, signal))
            .then(() => {
              originalUploaded = true;
            }),
        );
      }
      if (!normalizedRecording || (target.privacySafe && !privacySafeRecording)) {
        emit("normalizing", target);
      }
      if (!normalizedRecording) {
        preparationTasks.push(
          dependencies.normalizeVideo(recording).then((prepared) => {
            normalizedRecording = prepared;
          }),
        );
      }
      if (target.privacySafe && !privacySafeRecording) {
        preparationTasks.push(
          dependencies.normalizePrivacySafeFallback(recording).then((prepared) => {
            privacySafeRecording = prepared;
          }),
        );
      }
      await Promise.all(preparationTasks);

      const analysisUploadTasks: Promise<void>[] = [];
      if (!analysisUploaded) {
        emit("uploading_analysis", target);
        analysisUploadTasks.push(
          networkStep((signal) => dependencies.uploadVideo(normalizedRecording as RecordedSet, target.analysis, signal))
            .then(() => {
              analysisUploaded = true;
            }),
        );
      }
      if (target.privacySafe && !privacySafeUploaded) {
        emit("uploading_analysis", target);
        analysisUploadTasks.push(
          networkStep((signal) => dependencies.uploadVideo(privacySafeRecording as RecordedSet, target.privacySafe!, signal))
            .then(() => {
              privacySafeUploaded = true;
            }),
        );
      }
      await Promise.all(analysisUploadTasks);

      emit("finalizing", target);
      const accessToken = await dependencies.getAccessToken();
      await networkStep((signal) => dependencies.completeUpload(
        accessToken,
        target.sessionId,
        target.attemptId,
        recording.durationMs,
        Boolean(target.privacySafe),
        signal,
      ));
      const result = { sessionId: target.sessionId, target };
      clear();
      return result;
    })().catch((error) => {
      // Keep the server session and its reservation alive after transport or
      // preprocessing failures. The durable client journal resumes this exact
      // request instead of consuming a second credit. Explicit discard remains
      // the only action that cancels the server operation.
      const failedSessionId = currentTarget?.sessionId ?? null;
      clear();
      dependencies.onFailure?.({ error, sessionId: failedSessionId });
      throw error;
    });
    activeRun = operation;
    void operation.finally(() => {
      if (activeRun === operation) activeRun = null;
    }).catch(() => undefined);
    return operation;
  };

  return {
    currentProgress: () => progress,
    reset,
    cancelUpload: () => {
      if (cancellation) return cancellation;
      userDiscarded = true;
      activeNetworkControllers.forEach((controller) => controller.abort());
      const target = currentTarget;
      dependencies.onCancelled?.({ sessionId: target?.sessionId ?? null });
      cancellation = (async () => {
        if (target && dependencies.cancelUpload) {
          await dependencies.cancelUpload({
            sessionId: target.sessionId,
            reservationId: target.reservationId,
            reason: "user_discarded",
          }).catch(() => undefined);
        }
        clear();
      })().finally(() => { cancellation = null; });
      return cancellation;
    },
    run,
    subscribe,
  };
}
