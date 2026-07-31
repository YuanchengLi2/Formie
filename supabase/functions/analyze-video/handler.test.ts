import type { GeminiFile } from "../_shared/gemini-files";
import { analyzeVideoHandler, type AnalyzeVideoDependencies, type AnalyzeVideoSession } from "./handler";

const file: GeminiFile = { name: "files/1", uri: "uri", mimeType: "video/mp4", state: "ACTIVE" };

function session(overrides: Partial<AnalyzeVideoSession> = {}): AnalyzeVideoSession {
  return {
    id: "session-1",
    userId: "user-1",
    status: "processing",
    stage: "video_processing",
    failureCode: null,
    videoPath: "user-1/session-1/original.mp4",
    analysisVideoPath: null,
    analysisFallbackVideoPath: null,
    analysisInputVariant: "primary",
    analysisInputStrategy: "video",
    durationMs: 30_000,
    geminiFileName: null,
    geminiFileUri: null,
    geminiFileState: null,
    result: null,
    ...overrides,
  };
}

function request() {
  return new Request("https://example.test/analyze-video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: "session-1" }) });
}

function dependencies(current = session(), overrides: Partial<AnalyzeVideoDependencies> = {}): AnalyzeVideoDependencies {
  return {
    authenticate: jest.fn(async () => "user-1"),
    loadSession: jest.fn(async () => current),
    uploadFile: jest.fn(async () => ({ ...file, state: "PROCESSING" })),
    saveFile: jest.fn(async () => undefined),
    getFile: jest.fn(async () => file),
    saveFileState: jest.fn(async () => undefined),
    advancePipeline: jest.fn(async () => ({ status: "processing", stage: "selecting_evidence" })),
    recordStageFailure: jest.fn(async () => ({ attempts: 1, terminal: false })),
    markFailed: jest.fn(async () => undefined),
    deleteFile: jest.fn(async () => undefined),
    releaseStoredVideo: jest.fn(async () => undefined),
    activateFallbackInput: jest.fn(async () => false),
    ...overrides,
  };
}

describe("analyzeVideoHandler single-pass flow", () => {
  it("keeps a malformed model response resumable instead of failing the whole session immediately", async () => {
    const current = session({ stage: "analyzing", geminiFileName: file.name, geminiFileUri: file.uri, geminiFileState: "ACTIVE" });
    const deps = dependencies(current, {
      advancePipeline: jest.fn(async () => {
        throw Object.assign(new Error("Combined analysis response validation failed"), { code: "ANALYSIS_INVALID_EVIDENCE" });
      }),
    });
    const response = await analyzeVideoHandler(request(), deps);
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual(expect.objectContaining({
      status: "processing",
      stage: "analyzing",
      retrying: true,
      attempt: 1,
    }));
    expect(deps.recordStageFailure).toHaveBeenCalledWith("session-1", "analyzing", "ANALYSIS_INVALID_EVIDENCE");
    expect(deps.markFailed).not.toHaveBeenCalled();
  });

  it("uploads the source video once and waits for Gemini file processing", async () => {
    const deps = dependencies();
    const response = await analyzeVideoHandler(request(), deps);
    expect(response.status).toBe(202);
    expect(deps.uploadFile).toHaveBeenCalledTimes(1);
    expect(deps.releaseStoredVideo).toHaveBeenCalledWith(expect.objectContaining({ id: "session-1" }), "source_uploaded");
    expect(deps.advancePipeline).not.toHaveBeenCalled();
  });

  it("advances exactly one persisted single-pass stage after the file becomes active", async () => {
    const current = session({ geminiFileName: file.name, geminiFileUri: file.uri, geminiFileState: "ACTIVE" });
    const deps = dependencies(current);
    const response = await analyzeVideoHandler(request(), deps);
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual(expect.objectContaining({ status: "processing", stage: "selecting_evidence" }));
    expect(deps.advancePipeline).toHaveBeenCalledWith(current, file);
    expect(deps.deleteFile).not.toHaveBeenCalled();
  });

  it("returns and cleans up only after the staged runner saves a final result", async () => {
    const finalResult = { status: "complete", score: 82, priorityCorrections: [] };
    const current = session({ geminiFileName: file.name, geminiFileUri: file.uri, geminiFileState: "ACTIVE" });
    const deps = dependencies(current, { advancePipeline: jest.fn(async () => ({ status: "complete", stage: "complete", result: finalResult })) });
    const response = await analyzeVideoHandler(request(), deps);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({ status: "complete", stage: "complete", result: finalResult }));
    expect(deps.deleteFile).toHaveBeenCalledWith(file.name);
    expect(deps.releaseStoredVideo).toHaveBeenCalledWith(current, "terminal");
  });

  it("returns terminal stored results without repeating any model stage", async () => {
    const finalResult = { status: "complete", score: 82 };
    const deps = dependencies(session({ status: "complete", result: finalResult }));
    const response = await analyzeVideoHandler(request(), deps);
    expect(response.status).toBe(200);
    expect(deps.advancePipeline).not.toHaveBeenCalled();
  });

  it("returns the persisted failure code for a terminal failed session", async () => {
    const setDeclaration = {
      exercise: { source: "catalog", catalogExerciseId: 12095, label: "Bodyweight Squat" },
      amount: { kind: "reps", value: 3, countScope: "total" },
      load: { kind: "bodyweight", value: null, unit: null, scope: null },
      side: "bilateral",
      styles: [],
      focusNote: null,
    };
    const deps = dependencies(session({
      status: "failed",
      stage: "analyzing",
      failureCode: "ANALYSIS_FAILED",
      setDeclaration,
    }));
    const response = await analyzeVideoHandler(request(), deps);

    expect(await response.json()).toEqual(expect.objectContaining({
      status: "failed",
      failureCode: "ANALYSIS_FAILED",
      setDeclaration,
    }));
  });

  it("keeps the same persisted stage resumable after the first transient failure", async () => {
    const current = session({ stage: "analyzing", geminiFileName: file.name, geminiFileUri: file.uri, geminiFileState: "ACTIVE" });
    const deps = dependencies(current, { advancePipeline: jest.fn(async () => { throw new Error("provider timeout"); }) });
    const response = await analyzeVideoHandler(request(), deps);

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual(expect.objectContaining({ status: "processing", stage: "analyzing", retrying: true, attempt: 1 }));
    expect(deps.recordStageFailure).toHaveBeenCalledWith(current.id, "analyzing", "ANALYSIS_FAILED");
    expect(deps.markFailed).not.toHaveBeenCalled();
  });

  it("becomes terminal with a stable code after the controlled retry is exhausted", async () => {
    const current = session({ stage: "writing_coaching", geminiFileName: file.name, geminiFileUri: file.uri, geminiFileState: "ACTIVE" });
    const deps = dependencies(current, {
      advancePipeline: jest.fn(async () => { throw new Error("provider timeout again"); }),
      recordStageFailure: jest.fn(async () => ({ attempts: 2, terminal: true })),
    });
    const response = await analyzeVideoHandler(request(), deps);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ message: "Analysis could not continue", code: "ANALYSIS_FAILED" });
    expect(deps.markFailed).toHaveBeenCalledWith(current.id, "ANALYSIS_FAILED");
    expect(deps.releaseStoredVideo).toHaveBeenCalledWith(current, "terminal");
  });

  it("preserves a provider error code for retries and terminal diagnostics", async () => {
    const providerError = Object.assign(new Error("rate limited"), { code: "GEMINI_HTTP_429" });
    const current = session({ stage: "writing_coaching", geminiFileName: file.name, geminiFileUri: file.uri, geminiFileState: "ACTIVE" });
    const deps = dependencies(current, { advancePipeline: jest.fn(async () => { throw providerError; }) });
    const response = await analyzeVideoHandler(request(), deps);
    expect(response.status).toBe(202);
    expect(deps.recordStageFailure).toHaveBeenCalledWith(current.id, "writing_coaching", "GEMINI_HTTP_429");
  });

  it("switches a prohibited primary video to its privacy-safe fallback without retrying the blocked file", async () => {
    const blocked = Object.assign(new Error("Gemini blocked the video"), { code: "GEMINI_PROHIBITED_CONTENT" });
    const current = session({
      stage: "analyzing",
      geminiFileName: file.name,
      geminiFileUri: file.uri,
      geminiFileState: "ACTIVE",
      analysisFallbackVideoPath: "user-1/session-1/privacy-safe-upper-body.mp4",
      analysisInputVariant: "primary",
    });
    const deps = dependencies(current, {
      advancePipeline: jest.fn(async () => { throw blocked; }),
      activateFallbackInput: jest.fn(async () => true),
    });

    const response = await analyzeVideoHandler(request(), deps);

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual(expect.objectContaining({
      status: "processing",
      stage: "video_processing",
      retrying: true,
      attempt: 1,
    }));
    expect(deps.activateFallbackInput).toHaveBeenCalledWith(current.id);
    expect(deps.deleteFile).toHaveBeenCalledWith(file.name);
    expect(deps.recordStageFailure).not.toHaveBeenCalled();
    expect(deps.markFailed).not.toHaveBeenCalled();
  });

  it("stops immediately with the precise block code when no safe fallback exists", async () => {
    const blocked = Object.assign(new Error("Gemini blocked the video"), { code: "GEMINI_PROHIBITED_CONTENT" });
    const current = session({ stage: "analyzing", geminiFileName: file.name, geminiFileUri: file.uri, geminiFileState: "ACTIVE" });
    const deps = dependencies(current, {
      advancePipeline: jest.fn(async () => { throw blocked; }),
      activateFallbackInput: jest.fn(async () => false),
    });

    const response = await analyzeVideoHandler(request(), deps);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      message: "Analysis could not continue",
      code: "GEMINI_PROHIBITED_CONTENT",
    });
    expect(deps.recordStageFailure).not.toHaveBeenCalled();
    expect(deps.markFailed).toHaveBeenCalledWith(current.id, "GEMINI_PROHIBITED_CONTENT");
    expect(deps.releaseStoredVideo).toHaveBeenCalledWith(current, "terminal");
  });
});
