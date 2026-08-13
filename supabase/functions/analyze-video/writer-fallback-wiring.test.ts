import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "index.ts"), "utf8");

describe("v73 focused analyst and Flash Lite writer wiring", () => {
  it("uses one full-video Gemini 3.6 call followed by one text-only Gemini 3.1 Flash Lite call", () => {
    expect(source).not.toContain("runShortClipRechecks({");
    expect(source).toContain("buildWholeVideoWritingPrompt");
    expect(source).toContain("buildTextGenerateContentRequest");
    expect(source).toContain("modelName: WRITER_MODEL");
    expect(source).not.toContain("preserveSchemaBounds: true");
    expect(source).not.toContain('runStage(sessionId, "analyzing", { kind: "writer"');
    expect(source).toContain('runStage(sessionId, "finalizing", { kind: "writer"');
    expect(source).not.toContain("runNonBlockingWriter");
    expect(source).not.toContain("mergeWholeVideoWriting");
    expect(source).not.toContain("COACHING_WRITER_FALLBACK");
    expect(source).toContain("as WholeVideoWriting");
    expect(source).toContain('const PIPELINE_VERSION = "gemini-whole-video-v73-focused-analyst-flash-lite-writer"');
    expect(source).toContain('const ANALYST_MODEL = "gemini-3.6-flash"');
    expect(source).toContain('const WRITER_MODEL = "gemini-3.1-flash-lite"');
    expect(source).not.toContain("parseBoundaryFreeAnalysis");
    expect(source).not.toContain("analysisContractError");
    expect(source).not.toContain("coaching completer");
    expect(source).not.toContain("runShortClipRechecks");
    expect(source.match(/buildVideoGenerateContentRequest\(/g)).toHaveLength(1);
    expect(source.match(/buildTextGenerateContentRequest\(/g)).toHaveLength(1);
  });

  it("loads complete neutral catalog mechanics from the declaration ID first", () => {
    expect(source).toContain("declaration?.exercise.catalogExerciseId ?? session.exercise_variant_v2_id");
    expect(source).toContain('.select("name,family,mechanics")');
    for (const key of ["equipmentClass", "movementFamily", "support", "trajectory", "laterality", "stance", "grip", "angle"]) {
      expect(source).toContain(key);
    }
    expect(source).toContain("catalog: rawSession.catalogExerciseContext");
  });

  it("durably reuses raw analyst output before writer finalization and persists no model rep timeline", () => {
    const analystStage = source.indexOf('runStage(sessionId, "analyzing"');
    const writerStage = source.indexOf('runStage(sessionId, "finalizing"');
    expect(analystStage).toBeGreaterThanOrEqual(0);
    expect(analystStage).toBeLessThan(writerStage);
    expect(source).toContain("limitWholeVideoAnalysis");
    expect(source).toContain("rep_timeline: []");
    expect(source).not.toContain("rep_timeline: candidate.repTimeline");
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
