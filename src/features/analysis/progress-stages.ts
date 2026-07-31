export const ANALYSIS_PROGRESS_STAGES = [
  { key: "uploading", label: "Securing your recording" },
  { key: "mapping", label: "Analyzing the full set" },
  { key: "evidence", label: "Selecting the best evidence" },
  { key: "coaching", label: "Writing your coaching" },
] as const;

export type AnalysisProgressState = "complete" | "active" | "pending";

const STAGE_INDEX: Record<string, number> = {
  uploading: 0,
  creating_session: 0,
  uploading_original: 0,
  normalizing: 0,
  uploading_analysis: 0,
  finalizing: 0,
  video_processing: 1,
  analyzing: 1,
  selecting_evidence: 2,
  checking_consistency: 2,
  double_checking: 2,
  writing_coaching: 3,
  coaching: 3,
};

const EVIDENCE_STAGE_LABELS: Record<string, string> = {
  checking_consistency: "Checking facts and coaching",
  double_checking: "Double-checking a video detail",
};

const UPLOAD_STAGE_LABELS: Record<string, string> = {
  creating_session: "Starting secure upload",
  uploading_original: "Saving your recording",
  normalizing: "Preparing video for analysis",
  uploading_analysis: "Uploading analysis copy",
  finalizing: "Starting analysis",
};

export function analysisProgress(stage: string | null) {
  const activeIndex = stage ? STAGE_INDEX[stage] ?? 0 : 0;

  return {
    activeIndex,
    items: ANALYSIS_PROGRESS_STAGES.map((item, index) => ({
      ...item,
      ...(index === 0 && stage && UPLOAD_STAGE_LABELS[stage] ? { label: UPLOAD_STAGE_LABELS[stage] } : {}),
      ...(index === 2 && stage && EVIDENCE_STAGE_LABELS[stage] ? { label: EVIDENCE_STAGE_LABELS[stage] } : {}),
      state: (index < activeIndex ? "complete" : index === activeIndex ? "active" : "pending") as AnalysisProgressState,
    })),
  };
}
