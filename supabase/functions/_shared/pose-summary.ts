export type PoseSummary = {
  version: 1;
  model: "MoveNet.SinglePose.Thunder";
  durationMs: number;
  requestedFrames: number;
  framesAnalyzed: number;
  sampleFps: number;
  overallVisibility: number;
  seriesColumns: string[];
  series: (number | null)[][];
};

export type PoseTracking = Pick<PoseSummary, "model" | "requestedFrames" | "framesAnalyzed" | "sampleFps" | "overallVisibility">;

export function poseTrackingFromSummary(summary: PoseSummary | null): PoseTracking | null {
  if (!summary) return null;
  return {
    model: summary.model,
    requestedFrames: summary.requestedFrames,
    framesAnalyzed: summary.framesAnalyzed,
    sampleFps: summary.sampleFps,
    overallVisibility: summary.overallVisibility,
  };
}

export function validatePoseSummary(value: unknown, durationMs: number): PoseSummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("pose summary must be an object");
  const summary = value as Record<string, unknown>;
  if (summary.version !== 1) throw new Error("pose summary version is invalid");
  if (summary.model !== "MoveNet.SinglePose.Thunder") throw new Error("pose summary model is invalid");
  if (summary.durationMs !== durationMs) throw new Error("pose summary duration does not match the video");
  if (!Number.isInteger(summary.requestedFrames) || Number(summary.requestedFrames) < 4 || Number(summary.requestedFrames) > 96) throw new Error("pose summary requested frames are invalid");
  if (!Number.isInteger(summary.framesAnalyzed) || Number(summary.framesAnalyzed) < 4 || Number(summary.framesAnalyzed) > Number(summary.requestedFrames)) throw new Error("pose summary analyzed frames are invalid");
  if (typeof summary.sampleFps !== "number" || summary.sampleFps <= 0 || summary.sampleFps > 24) throw new Error("pose summary sample rate is invalid");
  if (typeof summary.overallVisibility !== "number" || summary.overallVisibility < 0 || summary.overallVisibility > 1) throw new Error("pose summary visibility is invalid");
  if (!Array.isArray(summary.seriesColumns) || summary.seriesColumns.length < 3 || summary.seriesColumns.length > 40 || summary.seriesColumns[0] !== "timeMs" || !summary.seriesColumns.every((item) => typeof item === "string")) throw new Error("pose summary columns are invalid");
  if (!Array.isArray(summary.series) || summary.series.length < 4 || summary.series.length > 96 || summary.series.length > Number(summary.framesAnalyzed)) throw new Error("pose summary frames are invalid");
  let previousTime = -1;
  for (const row of summary.series) {
    if (!Array.isArray(row) || row.length !== summary.seriesColumns.length || !row.every((item) => item === null || (typeof item === "number" && Number.isFinite(item)))) throw new Error("pose summary series row is invalid");
    const time = row[0];
    if (typeof time !== "number" || !Number.isInteger(time) || time < 0 || time > durationMs || time <= previousTime) throw new Error("pose summary timestamp is invalid");
    previousTime = time;
  }
  return value as PoseSummary;
}
