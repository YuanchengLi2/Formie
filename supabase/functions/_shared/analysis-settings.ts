export const MIN_ANALYSIS_VIDEO_DURATION_MS = 3_000;
export const MAX_ANALYSIS_VIDEO_DURATION_MS = 15_000;

export type AnalysisRuntimeContract = Readonly<{
  pipelineVersion: "gemini-whole-video-v88-evidence-scoring";
  analystModel: "gemini-3.7-flash";
  analystThinkingLevel: "high";
  mediaResolution: "MEDIA_RESOLUTION_HIGH";
  requestedFps: 12;
  writerModel: "gemini-3.1-flash-lite";
  writerThinkingLevel: "low";
  requestedIssueScope: "4-6-highest-consequence";
}>;

export const ANALYSIS_RUNTIME_CONTRACT: AnalysisRuntimeContract = Object.freeze({
  pipelineVersion: "gemini-whole-video-v88-evidence-scoring",
  analystModel: "gemini-3.7-flash",
  analystThinkingLevel: "high",
  mediaResolution: "MEDIA_RESOLUTION_HIGH",
  requestedFps: 12,
  writerModel: "gemini-3.1-flash-lite",
  writerThinkingLevel: "low",
  requestedIssueScope: "4-6-highest-consequence",
});

// Compatibility aliases remain derived from the one runtime contract so older
// helpers cannot drift from request construction or telemetry.
export const REQUESTED_ANALYSIS_FPS = ANALYSIS_RUNTIME_CONTRACT.requestedFps;
export const REQUESTED_ANALYSIS_MEDIA_RESOLUTION = ANALYSIS_RUNTIME_CONTRACT.mediaResolution;
export const ANALYST_THINKING_LEVEL = ANALYSIS_RUNTIME_CONTRACT.analystThinkingLevel;
export const WRITER_THINKING_LEVEL = ANALYSIS_RUNTIME_CONTRACT.writerThinkingLevel;
