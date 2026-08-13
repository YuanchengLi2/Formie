import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "index.ts"), "utf8");

describe("v78 four-to-six core-issue Gemini 3.7 analyst and Flash Lite writer wiring", () => {
  it("uses one full-video Gemini 3.7 call followed by text-only Gemini 3.1 Flash Lite writing", () => {
    expect(source).not.toContain("runShortClipRechecks({");
    expect(source).toContain("buildWholeVideoWritingPrompt");
    expect(source).toContain("buildTextGenerateContentRequest");
    expect(source).toContain("modelName: WRITER_MODEL");
    expect(source).not.toContain("preserveSchemaBounds: true");
    expect(source).not.toContain('runStage(sessionId, "analyzing", { kind: "writer"');
    expect(source).toContain('runStage(sessionId, "finalizing", { kind: "writer"');
    expect(source).not.toContain("runNonBlockingWriter");
    expect(source).not.toContain("mergeWholeVideoWriting");
    expect(source).toContain("writeValidatedCoaching");
    expect(source).toContain("parseWholeVideoAnalysis");
    expect(source).toContain("parseWholeVideoWriting");
    expect(source).toContain("normalizeWholeVideoWriting");
    expect(source).toContain("buildWholeVideoWritingRepairPrompt");
    expect(source).toContain('const PIPELINE_VERSION = "gemini-whole-video-v78-gemini-3-7-core-4-6-flash-lite-writer"');
    expect(source).toContain('const ANALYST_MODEL = "gemini-3.7-flash"');
    expect(source).toContain('const WRITER_MODEL = "gemini-3.1-flash-lite"');
    expect(source).not.toContain("limitWholeVideoAnalysis");
    expect(source).not.toContain("analysisContractError");
    expect(source).not.toContain("coaching completer");
    expect(source).not.toContain("runShortClipRechecks");
    expect(source.match(/buildVideoGenerateContentRequest\(/g)).toHaveLength(1);
    expect(source.match(/buildTextGenerateContentRequest\(/g)).toHaveLength(1);
  });

  it("does not load or pass catalog context to either model", () => {
    expect(source).not.toContain('from("exercise_variants_v2")');
    expect(source).not.toContain("catalogExerciseContext");
    expect(source).not.toContain("ExerciseCatalogContext");
    expect(source).toContain("buildBoundaryFreeAnalysisPrompt(durationMs, declaration)");
    expect(source).toContain("buildWholeVideoWritingPrompt(analysis, declaration)");
  });

  it("durably reuses raw analyst output before writer finalization and persists no model rep timeline", () => {
    const analystStage = source.indexOf('runStage(sessionId, "analyzing"');
    const writerStage = source.indexOf('runStage(sessionId, "finalizing"');
    expect(analystStage).toBeGreaterThanOrEqual(0);
    expect(analystStage).toBeLessThan(writerStage);
    expect(source).toContain("parseWholeVideoAnalysis");
    expect(source).toContain("rep_timeline: []");
    expect(source).not.toContain("rep_timeline: candidate.repTimeline");
    expect(source).toContain("hasStoredVideoEvidence: Boolean(storedStage?.output)");
    expect(source).toContain("analysisRetryCount: Number(session.analysis_retry_count ?? 0)");
    expect(source).toContain("retry: rawSession.analysisRetryCount ?? 0");
  });

  it("claims the analyst lease before publishing the analyzing stage", () => {
    const analyst = source.slice(
      source.indexOf("analyzeWholeVideo: async"),
      source.indexOf("saveAnalysis: async"),
    );
    expect(analyst.indexOf('runStage(sessionId, "analyzing"')).toBeLessThan(
      analyst.indexOf('saveSessionStage("analyzing")'),
    );
  });

});
