import { MAX_ANALYSIS_VIDEO_DURATION_MS } from "../_shared/analysis-settings.ts";

export type RetainedAnalysisInput = {
  videoPath: string | null;
  analysisVideoPath?: string | null;
  geminiFileName: string | null;
  durationMs?: number | null;
};

export type RetainedAnalysisInputDependencies = {
  videoExists: (path: string) => Promise<boolean>;
  getGeminiFileState: (name: string) => Promise<string>;
};

export async function verifyRetainedAnalysisInput(
  input: RetainedAnalysisInput,
  dependencies: RetainedAnalysisInputDependencies,
): Promise<"ready" | "video_missing" | "video_too_long"> {
  if (typeof input.durationMs === "number" && input.durationMs > MAX_ANALYSIS_VIDEO_DURATION_MS) {
    return "video_too_long";
  }
  if (input.videoPath && await dependencies.videoExists(input.videoPath)) {
    return "ready";
  }
  if (input.analysisVideoPath && await dependencies.videoExists(input.analysisVideoPath)) {
    return "ready";
  }
  if (!input.geminiFileName) {
    return "video_missing";
  }
  try {
    return await dependencies.getGeminiFileState(input.geminiFileName) === "ACTIVE"
      ? "ready"
      : "video_missing";
  } catch {
    return "video_missing";
  }
}
