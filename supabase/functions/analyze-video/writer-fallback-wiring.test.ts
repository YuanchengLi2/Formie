import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "index.ts"), "utf8");

describe("whole-video analyst and direct AI writer wiring", () => {
  it("uses one full-video model call followed by the AI writer without a parser or completer", () => {
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
    expect(source).toContain('const PIPELINE_VERSION = "gemini-whole-video-v72-leased-direct-ai-coaching"');
    expect(source.indexOf("return raw as JsonRecord")).toBeLessThan(source.indexOf("parseBoundaryFreeAnalysis(rawAnalysis, durationMs)"));
  });

  it("persists the complete per-repetition audit in the atomic result payload", () => {
    expect(source).toContain("rep_timeline: candidate.repTimeline");
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
