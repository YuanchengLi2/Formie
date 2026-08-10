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
    expect(source).not.toContain('runStage(sessionId, "analyzing", { kind: "writer"');
    expect(source).toContain("fallback: () => parseWholeVideoWriting(null, parsedAnalysis)");
    expect(source).toContain('const PIPELINE_VERSION = "gemini-whole-video-v57-nonblocking-writer"');
    expect(source.indexOf("return raw as JsonRecord")).toBeLessThan(source.indexOf("parseBoundaryFreeAnalysis(rawAnalysis, durationMs)"));
  });

  it("persists the complete per-repetition audit in the atomic result payload", () => {
    expect(source).toContain("rep_timeline: candidate.repTimeline");
  });

  it("returns analyst coaching when the text writer fails", async () => {
    await expect(runNonBlockingWriter({
      write: async () => { throw new Error("writer unavailable"); },
      parse: () => "writer copy",
      fallback: () => "analyst copy",
    })).resolves.toBe("analyst copy");
  });

  it("returns analyst coaching when the writer response cannot be parsed", async () => {
    await expect(runNonBlockingWriter({
      write: async () => ({ malformed: true }),
      parse: () => { throw new Error("malformed writer response"); },
      fallback: () => "analyst copy",
    })).resolves.toBe("analyst copy");
  });
});
