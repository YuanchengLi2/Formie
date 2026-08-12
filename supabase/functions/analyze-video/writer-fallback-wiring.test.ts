import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "index.ts"), "utf8");

describe("whole-video analyst wiring", () => {
  it("uses the analyst's original evidence-grounded coaching without a second model rewrite", () => {
    expect(source).not.toContain("runShortClipRechecks({");
    expect(source).not.toContain("buildWholeVideoWritingPrompt");
    expect(source).not.toContain("buildTextGenerateContentRequest");
    expect(source).not.toContain("WRITER_MODEL");
    expect(source).toContain("parseWholeVideoWriting(null, parsedAnalysis)");
    expect(source).toContain('const PIPELINE_VERSION = "gemini-whole-video-v66-original-coaching-provider-compatible"');
    expect(source).toContain("storedVideoStageOutput ?? await runStage");
    expect(source).not.toContain("preserveSchemaBounds: true");
    expect(source.indexOf("return raw as JsonRecord")).toBeLessThan(source.indexOf("parseBoundaryFreeAnalysis(rawAnalysis, durationMs)"));
  });

  it("persists the complete per-repetition audit in the atomic result payload", () => {
    expect(source).toContain("rep_timeline: candidate.repTimeline");
  });

});
