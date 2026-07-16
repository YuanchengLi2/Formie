import {
  completeAnalysisUpload,
  createAnalysisSession,
  uploadAnalysisVideo,
} from "@/features/analysis/api";
import { getAccessToken } from "@/features/auth/access-token";

import { createUploadCoordinator } from "./upload-coordinator";

export const analysisUploadCoordinator = createUploadCoordinator({
  getAccessToken,
  createSession: async (accessToken, previousSessionId) => {
    const session = await createAnalysisSession({ accessToken, previousSessionId });
    return {
      sessionId: session.sessionId,
      signedUrl: session.upload.signedUrl,
      uploadToken: session.upload.token,
      path: session.upload.path,
    };
  },
  uploadVideo: (recording, target) => uploadAnalysisVideo({
    localUri: recording.localUri,
    signedUrl: target.signedUrl,
    uploadToken: target.uploadToken,
  }),
  completeUpload: async (accessToken, sessionId, durationMs) => {
    await completeAnalysisUpload({ accessToken, sessionId, durationMs });
  },
});
