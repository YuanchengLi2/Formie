export type RetainedAnalysisInput = {
  videoPath: string | null;
  geminiFileName: string | null;
};

export type RetainedAnalysisInputDependencies = {
  videoExists: (path: string) => Promise<boolean>;
  getGeminiFileState: (name: string) => Promise<string>;
};

export async function verifyRetainedAnalysisInput(
  input: RetainedAnalysisInput,
  dependencies: RetainedAnalysisInputDependencies,
): Promise<"ready" | "video_missing"> {
  if (input.videoPath && await dependencies.videoExists(input.videoPath)) {
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
