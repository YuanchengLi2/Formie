import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "index.ts"), "utf8");

describe("whole-video analyst and coaching-writer wiring", () => {
  it("keeps video inspection factual and requires a text-only writer for final coaching", () => {
    expect(source).not.toContain("runShortClipRechecks({");
    expect(source).toContain("buildWholeVideoWritingPrompt");
    expect(source).toContain("buildTextGenerateContentRequest");
    expect(source).toContain("modelName: WRITER_MODEL");
    expect(source).toContain("parseRequiredWholeVideoWriting");
    expect(source).toContain("writeValidatedCoaching");
    expect(source).toContain("buildWholeVideoWritingRepairPrompt");
    expect(source).not.toContain("parseWholeVideoWriting(null, parsedAnalysis)");
    expect(source).toContain('const PIPELINE_VERSION = "gemini-whole-video-v67-fact-then-write"');
    expect(source).toContain("storedVideoStageOutput ?? await runStage");
    expect(source).toContain('runStage(sessionId, "finalizing", { kind: "writer"');
    expect(source).toContain("rawSession.hasStoredVideoEvidence = true");
    expect(source).toContain('rawSession.stage = "finalizing"');
    expect(source).not.toContain("preserveSchemaBounds: true");
    expect(source.indexOf("return raw as JsonRecord")).toBeLessThan(source.indexOf("parseBoundaryFreeAnalysis(rawAnalysis, durationMs)"));
  });

  it("persists the complete per-repetition audit in the atomic result payload", () => {
    expect(source).toContain("rep_timeline: candidate.repTimeline");
  });

});
