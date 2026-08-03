export type AnalysisVideoPaths = {
  videoPath: string | null;
  analysisVideoPath: string | null;
  analysisFallbackVideoPath?: string | null;
  analysisInputVariant?: string | null;
  analysisInputStrategy: string | null;
};

export function selectGeminiVideoPath(session: AnalysisVideoPaths): string {
  if (session.analysisInputVariant === "privacy_safe_upper_body") {
    if (!session.analysisFallbackVideoPath) throw new Error("Privacy-safe analysis video path is missing");
    return session.analysisFallbackVideoPath;
  }
  if (session.analysisInputStrategy === "upright_video" || session.analysisInputStrategy === "trimmed_crop" || session.analysisInputStrategy === "capture_ready_video") {
    if (!session.analysisVideoPath) throw new Error("Normalized analysis video path is missing");
    return session.analysisVideoPath;
  }
  if (!session.videoPath) throw new Error("Video path is missing");
  return session.videoPath;
}
