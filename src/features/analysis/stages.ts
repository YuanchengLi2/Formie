export const analysisStages = [
  { id: "video_check", label: "Checking your recording" },
  { id: "video_processing", label: "Preparing the full video" },
  { id: "technique_review", label: "Reviewing visible technique" },
  { id: "coaching", label: "Preparing your coaching" },
] as const;

export type AnalysisStageId = (typeof analysisStages)[number]["id"];
export type AnalysisStageState = "complete" | "active" | "pending";

export function isAnalysisStageId(value: string | null): value is AnalysisStageId {
  return analysisStages.some((stage) => stage.id === value);
}

export function getAnalysisStageState(currentStage: string | null): AnalysisStageState[] {
  if (!isAnalysisStageId(currentStage)) return analysisStages.map(() => "pending");
  const activeIndex = analysisStages.findIndex((stage) => stage.id === currentStage);
  return analysisStages.map((_, index) => (index < activeIndex ? "complete" : index === activeIndex ? "active" : "pending"));
}
