export type AnalysisFailureDisposition = {
  disposition: "retry_video_file" | "retry_finalization" | "terminal_failure";
  preserveGeminiFile: boolean;
  preserveStageOutput: boolean;
  exhausted: boolean;
};

export type AnalysisFailureContext = {
  code: string;
  providerStatus?: string;
  httpStatus?: number;
  completedStage: string | null;
  hasStoredVideoEvidence?: boolean;
  retryCount: number;
  maxRetries: number;
};

const PERMANENT_CODES = new Set([
  "VIDEO_NOT_FOUND",
  "VIDEO_TOO_LONG",
  "ANALYSIS_VIDEO_EMPTY",
  "ANALYSIS_VIDEO_INVALID_TYPE",
  "GEMINI_FILE_FAILED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "INVALID_ARGUMENT",
  "UNSUPPORTED_INPUT",
]);

const FINALIZATION_CODES = /(?:CONTRACT|PARSE|WRITER|FINALIZ|RESULT_SAVE|COACHING)/;
const TRANSIENT_CODES = /(?:TIMEOUT|DEADLINE|NETWORK|FETCH|PROCESSING|RATE_LIMIT|TOO_MANY_REQUESTS|UNAVAILABLE|TEMPORAR|STAGE_BUSY)/;
const PERMANENT_CONTENT_BLOCK_CODES = /^GEMINI_(?:PROHIBITED_CONTENT|SAFETY|BLOCKLIST|IMAGE_SAFETY)$/;

export function analysisRetrySchedule(retryCount: number, now = new Date()): { backoffSeconds: number; nextRetryAt: string } {
  const backoffSeconds = Math.min(5 * 2 ** Math.max(0, retryCount - 1), 60);
  return {
    backoffSeconds,
    nextRetryAt: new Date(now.getTime() + backoffSeconds * 1_000).toISOString(),
  };
}

export function classifyAnalysisFailure(input: AnalysisFailureContext): AnalysisFailureDisposition {
  const exhausted = input.retryCount >= input.maxRetries;
  const providerFailed = input.providerStatus?.toUpperCase() === "FAILED";
  const permanent = PERMANENT_CODES.has(input.code) || PERMANENT_CONTENT_BLOCK_CODES.test(input.code) || providerFailed || input.httpStatus === 401 || input.httpStatus === 403 || input.httpStatus === 404 || input.httpStatus === 415;
  if (permanent || exhausted) {
    return { disposition: "terminal_failure", preserveGeminiFile: false, preserveStageOutput: Boolean(input.hasStoredVideoEvidence), exhausted };
  }

  const hasVideoEvidence = Boolean(input.hasStoredVideoEvidence) || input.completedStage === "analyzing" || input.completedStage === "finalizing";
  if (hasVideoEvidence && (FINALIZATION_CODES.test(input.code) || input.completedStage === "finalizing")) {
    return { disposition: "retry_finalization", preserveGeminiFile: true, preserveStageOutput: true, exhausted: false };
  }

  const transientHttp = input.httpStatus === 429 || (typeof input.httpStatus === "number" && input.httpStatus >= 500);
  if (transientHttp || TRANSIENT_CODES.test(input.code) || !permanent) {
    return { disposition: "retry_video_file", preserveGeminiFile: true, preserveStageOutput: hasVideoEvidence, exhausted: false };
  }

  return { disposition: "terminal_failure", preserveGeminiFile: false, preserveStageOutput: hasVideoEvidence, exhausted: false };
}
