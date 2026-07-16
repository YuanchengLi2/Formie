import type { AnalysisCandidate } from "../_shared/analysis-contract";
import type { GeminiFile } from "../_shared/gemini-video";
import { analyzeVideoHandler, type AnalyzeVideoDependencies, type AnalyzeVideoSession } from "./handler";

const activeFile: GeminiFile = { name: "files/file-1", uri: "uri", mimeType: "video/mp4", state: "ACTIVE" };

function result(): AnalysisCandidate {
  return {
    status: "complete",
    recognition: { label: "Curl", variation: null, equipment: ["dumbbells"], confidence: 0.9, alternatives: [], catalogExerciseId: null, cameraView: "side" },
    videoCheck: { outcome: "usable", usableObservations: ["upper body"], limitations: [], retryReason: null, retryInstruction: null },
    overallAssessment: "The visible set was controlled.", score: null, scoreRationale: [], didWell: [], priorityCorrections: [], coachingCues: [], viewNote: "The side view showed the torso.", comparison: null,
  };
}

function session(overrides: Partial<AnalyzeVideoSession> = {}): AnalyzeVideoSession {
  return {
    id: "session-1", userId: "user-1", status: "processing", stage: "video_check", videoPath: "user-1/session-1/original.mp4", durationMs: 10_000,
    captureOrientation: "landscapeLeft", cameraFacing: "back", cameraLens: "wide", requestedFps: 24,
    geminiFileName: null, geminiFileUri: null, geminiFileState: null, result: null,
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
    uploadFile: jest.fn(async () => ({ ...activeFile, state: "PROCESSING" })),
    saveFile: jest.fn(async () => undefined),
    getFile: jest.fn(async () => activeFile),
    saveFileState: jest.fn(async () => undefined),
    buildPrompt: jest.fn(async () => "coach the actual camera view"),
    generate: jest.fn(async () => result()),
    markStage: jest.fn(async () => undefined),
    saveResult: jest.fn(async () => undefined),
    markFailed: jest.fn(async () => undefined),
    deleteFile: jest.fn(async () => undefined),
    ...overrides,
  };
}

describe("analyzeVideoHandler", () => {
  it("returns 404 for an unknown owned session", async () => {
    const deps = dependencies(session(), { loadSession: jest.fn(async () => null) });
    expect((await analyzeVideoHandler(request(), deps)).status).toBe(404);
  });

  it("returns an existing terminal result without another Gemini call", async () => {
    const existing = result();
    const deps = dependencies(session({ status: "complete", result: existing }));
    const response = await analyzeVideoHandler(request(), deps);
    expect(response.status).toBe(200);
    expect((await response.json()).result).toEqual(existing);
    expect(deps.uploadFile).not.toHaveBeenCalled();
    expect(deps.generate).not.toHaveBeenCalled();
  });

  it("rejects a session without an uploaded video", async () => {
    const deps = dependencies(session({ videoPath: null }));
    expect((await analyzeVideoHandler(request(), deps)).status).toBe(409);
  });

  it("uploads one Gemini file and returns resumable processing state", async () => {
    const deps = dependencies();
    const response = await analyzeVideoHandler(request(), deps);
    expect(response.status).toBe(202);
    expect(deps.uploadFile).toHaveBeenCalledWith(expect.objectContaining({ id: "session-1" }));
    expect(deps.saveFile).toHaveBeenCalledWith("session-1", expect.objectContaining({ name: "files/file-1" }));
    expect(deps.generate).not.toHaveBeenCalled();
  });

  it("waits while Gemini is processing the existing file", async () => {
    const deps = dependencies(session({ geminiFileName: "files/file-1", geminiFileUri: "uri", geminiFileState: "PROCESSING" }), {
      getFile: jest.fn(async () => ({ ...activeFile, state: "PROCESSING" })),
    });
    const response = await analyzeVideoHandler(request(), deps);
    expect(response.status).toBe(202);
    expect(deps.generate).not.toHaveBeenCalled();
  });

  it("persists one result and cleans up an active file", async () => {
    const deps = dependencies(session({ geminiFileName: "files/file-1", geminiFileUri: "uri", geminiFileState: "ACTIVE" }));
    const response = await analyzeVideoHandler(request(), deps);
    expect(response.status).toBe(200);
    expect(deps.generate).toHaveBeenCalledTimes(1);
    expect(deps.saveResult).toHaveBeenCalledWith("session-1", result());
    expect(deps.deleteFile).toHaveBeenCalledWith("files/file-1");
    expect((await response.json()).result).toEqual(result());
  });

  it("keeps a completed result when best-effort Gemini cleanup fails", async () => {
    const deps = dependencies(session({ geminiFileName: "files/file-1", geminiFileUri: "uri", geminiFileState: "ACTIVE" }), {
      deleteFile: jest.fn(async () => { throw new Error("cleanup unavailable"); }),
    });

    const response = await analyzeVideoHandler(request(), deps);

    expect(response.status).toBe(200);
    expect((await response.json()).result).toEqual(result());
    expect(deps.saveResult).toHaveBeenCalledWith("session-1", result());
  });

  it("persists failure when Gemini rejects a file or invalid output", async () => {
    const failedFile = dependencies(session({ geminiFileName: "files/file-1", geminiFileUri: "uri", geminiFileState: "PROCESSING" }), {
      getFile: jest.fn(async () => ({ ...activeFile, state: "FAILED" })),
    });
    expect((await analyzeVideoHandler(request(), failedFile)).status).toBe(502);
    expect(failedFile.markFailed).toHaveBeenCalled();

    const invalidOutput = dependencies(session({ geminiFileName: "files/file-1", geminiFileUri: "uri", geminiFileState: "ACTIVE" }), {
      generate: jest.fn(async () => { throw new Error("invalid twice"); }),
    });
    expect((await analyzeVideoHandler(request(), invalidOutput)).status).toBe(502);
    expect(invalidOutput.markFailed).toHaveBeenCalledWith("session-1", "GEMINI_ANALYSIS_FAILED");
  });
});
