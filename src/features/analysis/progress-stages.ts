export const ANALYSIS_PROGRESS_STAGES = [
  { key: "uploading", label: "Uploading video" },
  { key: "mapping", label: "Watching the complete exercise" },
  { key: "finalizing", label: "Finalizing" },
  { key: "complete", label: "Complete" },
] as const;

export type AnalysisProgressState = "complete" | "active" | "pending";

const STAGE_INDEX: Record<string, number> = {
  uploading: 0,
  creating_session: 0,
  uploading_original: 0,
  normalizing: 0,
  uploading_analysis: 0,
  finalizing: 2,
  uploading_video: 0,
  input_ready: 1,
  video_processing: 1,
  analyzing: 1,
  retry_wait: 2,
  complete: 3,
  failed: 3,
};

const UPLOAD_STAGE_LABELS: Record<string, string> = {
  creating_session: "Starting secure upload",
  uploading_original: "Saving your recording",
  normalizing: "Preparing video for analysis",
  uploading_analysis: "Uploading analysis copy",
  uploading_video: "Uploading video",
};

export function analysisProgress(stage: string | null) {
  const activeIndex = stage ? STAGE_INDEX[stage] ?? 0 : 0;
  const failed = stage === "failed";

  return {
    activeIndex,
    items: ANALYSIS_PROGRESS_STAGES.map((item, index) => ({
      ...item,
      ...(index === 3 && failed ? { label: "Analysis failed" } : {}),
      ...(stage === "complete" && index < 3 ? { state: "complete" as AnalysisProgressState } : {}),
      ...(stage === "complete" && index === 3 ? { state: "active" as AnalysisProgressState } : {}),
      ...(index === 0 && stage && UPLOAD_STAGE_LABELS[stage] ? { label: UPLOAD_STAGE_LABELS[stage] } : {}),
      ...(index === 1 && stage && ["input_ready", "video_processing", "analyzing"].includes(stage) ? { label: "Watching the complete exercise" } : {}),
      ...(index === 1 && stage === "retry_wait" ? { label: "Finishing your coaching" } : {}),
      state: (index < activeIndex ? "complete" : index === activeIndex ? "active" : "pending") as AnalysisProgressState,
    })),
  };
}
