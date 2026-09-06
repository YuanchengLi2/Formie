import { cancelAnalysis } from "@/features/access/api";
import { publishAccessMutation } from "@/features/access/access-events";
import { AnalysisApiError, completeAnalysisUpload, createAnalysisSession, uploadAnalysisVideo as uploadVideoArtifact } from "@/features/analysis/api";
import { getAccessToken } from "@/features/auth/access-token";
import { createUploadCoordinator } from "./upload-coordinator";
import { deviceVideoStore } from "./device-video-store";
import { normalizeVideoForAnalysis } from "./video-normalizer";
import { currentCaptureFlow } from "./capture-flow";
import { trackProductEvent } from "@/features/analytics/product-analytics";

export const analysisUploadCoordinator = createUploadCoordinator({
  getAccessToken,
  createRequestId: () => globalThis.crypto?.randomUUID?.()
    ?? `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  createSession: async (accessToken, declaration, previousSessionId, clientRequestId, signal) => {
    const captureFlowId = currentCaptureFlow();
    void trackProductEvent("upload_started", { exerciseId: declaration.exercise.catalogExerciseId ?? "custom" }, { captureFlowId });
    let session;
    try { session = await createAnalysisSession({
      accessToken,
      declaration,
      previousSessionId,
      clientRequestId,
      uploadProfile: "single_analysis_v1",
      signal,
    }); } catch (error) {
      const errorCategory = error instanceof AnalysisApiError
        ? error.code
        : error instanceof Error ? error.name : "unknown";
      void trackProductEvent("analysis_reservation_denied", { errorCategory }, { captureFlowId });
      throw error;
    }
    publishAccessMutation({ remaining: session.remaining ?? null, periodEndsAt: session.periodEndsAt ?? null });
    return {
      sessionId: session.sessionId,
      reservationId: session.reservationId,
      attemptId: session.attemptId,
      analysis: {
        signedUrl: session.analysisUpload.signedUrl,
        uploadToken: session.analysisUpload.token,
        path: session.analysisUpload.path,
      },
    };
  },
  // A timeout can arrive after Storage accepted all bytes but before the client
  // received the response. Upsert makes the bounded retry against this same,
  // session-scoped signed target idempotent.
  uploadVideo: (recording, target, signal) => uploadVideoArtifact({ localUri: recording.localUri, signedUrl: target.signedUrl, uploadToken: target.uploadToken, upsert: true, signal }),
  normalizeVideo: normalizeVideoForAnalysis,
  prepareAnalysisVideo: normalizeVideoForAnalysis.prepare,
  normalizePrivacySafeFallback: normalizeVideoForAnalysis.privacySafeUpperBody,
  bindLocalRecording: (sessionId, recording) => deviceVideoStore.bind(sessionId, recording),
  completeUpload: async (accessToken, sessionId, attemptId, durationMs, hasPrivacySafeFallback, signal, metadata) => {
    const byteLength = metadata?.byteLength;
    if (typeof byteLength !== "number" || !Number.isInteger(byteLength) || byteLength <= 0) {
      throw new Error("The prepared analysis video size could not be determined. Please retry the upload.");
    }
    const preparedByteLength = byteLength as number;
    await completeAnalysisUpload({
      accessToken,
      sessionId,
      attemptId,
      durationMs,
      signal,
      analysisInput: { kind: "capture_ready_video", durationPreserved: true, byteLength: preparedByteLength },
    });
    void trackProductEvent("upload_completed", { durationMs }, { captureFlowId: currentCaptureFlow(), analysisSessionId: sessionId });
  },
  cancelUpload: cancelAnalysis,
  onFailure: ({ error, sessionId }) => {
    void trackProductEvent("upload_failed", { errorCategory: error instanceof Error ? error.name : "unknown" }, { captureFlowId: currentCaptureFlow(), analysisSessionId: sessionId });
  },
  onCancelled: ({ sessionId }) => {
    void trackProductEvent("analysis_cancelled", { reason: "user_discarded" }, { captureFlowId: currentCaptureFlow(), analysisSessionId: sessionId });
  },
});
