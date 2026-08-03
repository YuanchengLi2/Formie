export const analysisStages = [
  { id: "input_ready", label: "Uploading video" },
  { id: "analyzing", label: "Watching the complete exercise" },
  { id: "finalizing", label: "Finalizing" },
  { id: "complete", label: "Complete" },
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
