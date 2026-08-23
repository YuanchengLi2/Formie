import { cancelAnalysis } from "@/features/access/api";
import { publishAccessMutation } from "@/features/access/access-events";
import { completeAnalysisUpload, createAnalysisSession, uploadAnalysisVideo as uploadVideoArtifact } from "@/features/analysis/api";
import { getAccessToken } from "@/features/auth/access-token";
import { createUploadCoordinator } from "./upload-coordinator";
import { deviceVideoStore } from "./device-video-store";
import { normalizeVideoForAnalysis } from "./video-normalizer";

export const analysisUploadCoordinator = createUploadCoordinator({
  getAccessToken,
  createRequestId: () => globalThis.crypto?.randomUUID?.()
    ?? `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  createSession: async (accessToken, declaration, previousSessionId, clientRequestId, signal) => {
    const session = await createAnalysisSession({
      accessToken,
      declaration,
      previousSessionId,
      clientRequestId,
      uploadProfile: "single_analysis_v1",
      signal,
    });
    publishAccessMutation({ remaining: session.remaining ?? null, periodEndsAt: session.periodEndsAt ?? null });
    return {
      sessionId: session.sessionId,
      reservationId: session.reservationId,
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
  completeUpload: async (accessToken, sessionId, durationMs, hasPrivacySafeFallback, signal, metadata) => {
    const byteLength = metadata?.byteLength;
    if (typeof byteLength !== "number" || !Number.isInteger(byteLength) || byteLength <= 0) {
      throw new Error("The prepared analysis video size could not be determined. Please retry the upload.");
    }
    const preparedByteLength = byteLength as number;
    await completeAnalysisUpload({
      accessToken,
      sessionId,
      durationMs,
      signal,
      analysisInput: { kind: "capture_ready_video", durationPreserved: true, byteLength: preparedByteLength },
    });
  },
  cancelUpload: cancelAnalysis,
});
