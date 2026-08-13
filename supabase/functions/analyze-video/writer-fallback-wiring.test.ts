import { readFileSync } from "node:fs";
import { join } from "node:path";

import { runNonBlockingWriter } from "./nonblocking-writer";

const source = readFileSync(join(__dirname, "index.ts"), "utf8");

describe("whole-video analyst and nonblocking writer wiring", () => {
  it("uses one full-video model call followed by a text-only writer that cannot fail analysis", () => {
    expect(source).not.toContain("runShortClipRechecks({");
    expect(source).toContain("buildWholeVideoWritingPrompt");
    expect(source).toContain("buildTextGenerateContentRequest");
    expect(source).toContain("modelName: WRITER_MODEL");
    expect(source).not.toContain("preserveSchemaBounds: true");
    expect(source).not.toContain('runStage(sessionId, "analyzing", { kind: "writer"');
    expect(source).toContain("fallback: () => mergeWholeVideoWriting(null, parsedAnalysis)");
    expect(source).toContain('const PIPELINE_VERSION = "gemini-whole-video-v70-reliable-coaching-and-scores"');
    expect(source.indexOf("return raw as JsonRecord")).toBeLessThan(source.indexOf("parseBoundaryFreeAnalysis(rawAnalysis, durationMs)"));
  });

  it("persists the complete per-repetition audit in the atomic result payload", () => {
    expect(source).toContain("rep_timeline: candidate.repTimeline");
  });

  it("returns analyst coaching when the text writer fails", async () => {
    await expect(runNonBlockingWriter({
      write: async () => { throw new Error("writer unavailable"); },
      merge: () => "writer copy",
      fallback: () => "analyst copy",
    })).resolves.toBe("analyst copy");
  });

  it("returns analyst coaching if merging unexpectedly fails", async () => {
    await expect(runNonBlockingWriter({
      write: async () => ({ malformed: true }),
      merge: () => { throw new Error("unexpected merge failure"); },
      fallback: () => "analyst copy",
    })).resolves.toBe("analyst copy");
  });
});
