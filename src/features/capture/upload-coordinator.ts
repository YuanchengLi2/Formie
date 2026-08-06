import type { SetDeclaration } from "@/features/analysis/set-declaration";

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
const SINGLE_UPLOAD_TIMEOUT_MS = 15_000;

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
  completeUpload: (accessToken: string, sessionId: string, durationMs: number, hasPrivacySafeFallback: boolean, signal: AbortSignal, metadata?: { byteLength?: number }) => Promise<void>;
  cancelReservation?: (reservationId: string) => Promise<void>;
};

async function retryNetworkStep<T>(
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < NETWORK_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), NETWORK_STEP_TIMEOUT_MS);
    try {
      return await operation(controller.signal);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

async function singleNetworkStep<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SINGLE_UPLOAD_TIMEOUT_MS);
  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
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
  ): Promise<{ sessionId: string; target: UploadTarget }> => {
    if (activeRun) return activeRun;
    const nextDeclarationKey = JSON.stringify({ declaration, previousSessionId: previousSessionId ?? null });
    if (declarationKey !== null && declarationKey !== nextDeclarationKey) clear();
    if (!clientRequestId) clientRequestId = dependencies.createRequestId();
    const requestId = clientRequestId;

    const operation = (async () => {
      if (!Number.isInteger(recording.durationMs) || recording.durationMs < captureVideoSettings.minimumDurationMs || recording.durationMs > captureVideoSettings.maxDurationSeconds * 1_000) {
        throw new Error("Recordings must be between 3 and 15 seconds.");
      }

      if (!currentTarget) {
        emit("creating_session", null);
        const accessToken = await dependencies.getAccessToken();
        currentTarget = await retryNetworkStep((signal) => dependencies.createSession(
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
        await singleNetworkStep((signal) => dependencies.uploadVideo(normalizedRecording as RecordedSet, target.analysis, signal));
        emit("finalizing", target);
        const accessToken = await dependencies.getAccessToken();
        await singleNetworkStep((signal) => dependencies.completeUpload(
          accessToken,
          target.sessionId,
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
          retryNetworkStep((signal) => dependencies.uploadVideo(recording, originalTarget as UploadArtifactTarget, signal))
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
          retryNetworkStep((signal) => dependencies.uploadVideo(normalizedRecording as RecordedSet, target.analysis, signal))
            .then(() => {
              analysisUploaded = true;
            }),
        );
      }
      if (target.privacySafe && !privacySafeUploaded) {
        emit("uploading_analysis", target);
        analysisUploadTasks.push(
          retryNetworkStep((signal) => dependencies.uploadVideo(privacySafeRecording as RecordedSet, target.privacySafe!, signal))
            .then(() => {
              privacySafeUploaded = true;
            }),
        );
      }
      await Promise.all(analysisUploadTasks);

      emit("finalizing", target);
      const accessToken = await dependencies.getAccessToken();
      await retryNetworkStep((signal) => dependencies.completeUpload(
        accessToken,
        target.sessionId,
        recording.durationMs,
        Boolean(target.privacySafe),
        signal,
      ));
      const result = { sessionId: target.sessionId, target };
      clear();
      return result;
    })().catch(async (error) => {
      const reservationId = currentTarget?.reservationId;
      if (reservationId && dependencies.cancelReservation) {
        await dependencies.cancelReservation(reservationId).catch(() => undefined);
      }
      clear();
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
    cancelReservation: () => {
      if (cancellation) return cancellation;
      const reservationId = currentTarget?.reservationId;
      cancellation = (async () => {
        if (reservationId && dependencies.cancelReservation) await dependencies.cancelReservation(reservationId).catch(() => undefined);
        reset();
      })().finally(() => { cancellation = null; });
      return cancellation;
    },
    run,
    subscribe,
  };
}
