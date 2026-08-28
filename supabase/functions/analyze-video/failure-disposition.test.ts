import { analysisRetrySchedule, classifyAnalysisFailure } from "./failure-disposition";

describe("analysis failure disposition", () => {
  it("schedules each transient retry from the current attempt without an undefined timestamp", () => {
    expect(analysisRetrySchedule(1, new Date("2026-08-27T20:00:00.000Z"))).toEqual({
      backoffSeconds: 5,
      nextRetryAt: "2026-08-27T20:00:05.000Z",
    });
    expect(analysisRetrySchedule(5, new Date("2026-08-27T20:00:00.000Z"))).toEqual({
      backoffSeconds: 60,
      nextRetryAt: "2026-08-27T20:01:00.000Z",
    });
  });

  it.each([
    ["ANALYSIS_FILE_PROCESSING", undefined, undefined],
    ["ANALYSIS_TIMEOUT", undefined, undefined],
    ["ANALYSIS_NETWORK_ERROR", undefined, undefined],
    ["PROVIDER_ERROR", 429, undefined],
    ["PROVIDER_ERROR", 503, undefined],
  ])("retries transient video failures without discarding the Gemini file", (code, httpStatus, providerStatus) => {
    expect(classifyAnalysisFailure({ code, httpStatus, providerStatus, completedStage: null, retryCount: 0, maxRetries: 3 })).toEqual({
      disposition: "retry_video_file",
      preserveGeminiFile: true,
      preserveStageOutput: false,
      exhausted: false,
    });
  });

  it.each(["VIDEO_NOT_FOUND", "ANALYSIS_VIDEO_EMPTY", "ANALYSIS_VIDEO_INVALID_TYPE", "GEMINI_FILE_FAILED", "UNAUTHORIZED"])(
    "terminally rejects permanent input/provider failure %s",
    (code) => {
      expect(classifyAnalysisFailure({ code, completedStage: null, retryCount: 0, maxRetries: 3 }).disposition).toBe("terminal_failure");
    },
  );

  it("repairs finalization from stored video evidence without another video pass", () => {
    expect(classifyAnalysisFailure({
      code: "ANALYSIS_CONTRACT_INVALID",
      completedStage: "analyzing",
      hasStoredVideoEvidence: true,
      retryCount: 0,
      maxRetries: 3,
    })).toEqual({ disposition: "retry_finalization", preserveGeminiFile: true, preserveStageOutput: true, exhausted: false });
  });

  it("bounds unknown provider failures before making them terminal", () => {
    expect(classifyAnalysisFailure({ code: "PROVIDER_UNKNOWN", completedStage: null, retryCount: 1, maxRetries: 3 }).disposition).toBe("retry_video_file");
    expect(classifyAnalysisFailure({ code: "PROVIDER_UNKNOWN", completedStage: null, retryCount: 3, maxRetries: 3 })).toMatchObject({ disposition: "terminal_failure", exhausted: true });
  });

  it("does not permanently fail an opaque Gemini HTTP 400 without an explicit invalid-input code", () => {
    expect(classifyAnalysisFailure({
      code: "GEMINI_HTTP_400",
      httpStatus: 400,
      completedStage: null,
      retryCount: 0,
      maxRetries: 3,
    })).toMatchObject({ disposition: "retry_video_file", exhausted: false });

    expect(classifyAnalysisFailure({
      code: "UNSUPPORTED_INPUT",
      httpStatus: 400,
      completedStage: null,
      retryCount: 0,
      maxRetries: 3,
    })).toMatchObject({ disposition: "terminal_failure" });
  });
});
