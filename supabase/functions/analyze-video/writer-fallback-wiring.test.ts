import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "index.ts"), "utf8");

describe("single-pass whole-video wiring", () => {
  it("uses one video model call and derives display copy without a rewatch or writer call", () => {
    expect(source).not.toContain("runShortClipRechecks({");
    expect(source).not.toContain("buildWholeVideoWritingPrompt");
    expect(source).not.toContain("modelName: WRITER_MODEL");
    expect(source).not.toContain('runStage(sessionId, "analyzing", { kind: "writer"');
    expect(source).toContain("parseWholeVideoWriting(null, parsedAnalysis)");
    expect(source).toContain('const PIPELINE_VERSION = "gemini-whole-video-v56-single-call-rep-audit"');
    expect(source.indexOf("return raw as JsonRecord")).toBeLessThan(source.indexOf("parseBoundaryFreeAnalysis(rawAnalysis, durationMs)"));
  });
});
