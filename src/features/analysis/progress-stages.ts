export const ANALYSIS_PROGRESS_STAGES = [
  { key: "uploading", label: "Securing your recording" },
  { key: "video_check", label: "Checking your recording" },
  { key: "video_processing", label: "Preparing the full video" },
  { key: "technique_review", label: "Reviewing visible technique" },
  { key: "coaching", label: "Preparing your coaching" },
] as const;

export type AnalysisProgressState = "complete" | "active" | "pending";

export function analysisProgress(stage: string | null) {
  const matchingIndex = ANALYSIS_PROGRESS_STAGES.findIndex((item) => item.key === stage);
  const activeIndex = matchingIndex >= 0 ? matchingIndex : 0;

  return {
    activeIndex,
    items: ANALYSIS_PROGRESS_STAGES.map((item, index) => ({
      ...item,
      state: (index < activeIndex ? "complete" : index === activeIndex ? "active" : "pending") as AnalysisProgressState,
    })),
  };
}
