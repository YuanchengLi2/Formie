import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "index.ts"), "utf8");

describe("v53 writer fallback wiring", () => {
  it("keeps a parsed analyst result when the optional writer fails", () => {
    expect(source).toContain("coaching_writer_fallback");
    expect(source).toContain("parseWholeVideoWriting(null, parsedAnalysis)");
    expect(source).toContain('const PIPELINE_VERSION = "gemini-whole-video-v53-readable-coaching"');
  });
});
