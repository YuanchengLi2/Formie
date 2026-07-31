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
      privacySafeFallback: normalizeVideoForAnalysis.supportsPrivacySafeFallback,
      signal,
    });
    return {
      sessionId: session.sessionId,
      original: {
        signedUrl: session.upload.signedUrl,
        uploadToken: session.upload.token,
        path: session.upload.path,
      },
      analysis: {
        signedUrl: session.analysisUpload.signedUrl,
        uploadToken: session.analysisUpload.token,
        path: session.analysisUpload.path,
      },
      ...(session.privacySafeUpload ? {
        privacySafe: {
          signedUrl: session.privacySafeUpload.signedUrl,
          uploadToken: session.privacySafeUpload.token,
          path: session.privacySafeUpload.path,
        },
      } : {}),
    };
  },
  uploadVideo: (recording, target, signal) => uploadVideoArtifact({ localUri: recording.localUri, signedUrl: target.signedUrl, uploadToken: target.uploadToken, signal }),
  normalizeVideo: normalizeVideoForAnalysis,
  normalizePrivacySafeFallback: normalizeVideoForAnalysis.privacySafeUpperBody,
  bindLocalRecording: (sessionId, recording) => deviceVideoStore.bind(sessionId, recording),
  completeUpload: async (accessToken, sessionId, durationMs, hasPrivacySafeFallback, signal) => {
    await completeAnalysisUpload({
      accessToken,
      sessionId,
      durationMs,
      signal,
      analysisInput: { kind: "upright_video", durationPreserved: true },
      ...(hasPrivacySafeFallback ? {
        privacySafeFallback: { kind: "upper_body", durationPreserved: true },
      } : {}),
    });
  },
});
