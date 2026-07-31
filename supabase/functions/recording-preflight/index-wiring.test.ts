import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("recording preflight production wiring", () => {
  it("runs independent movement-visibility and perspective inspections in parallel", () => {
    const source = readFileSync(resolve(__dirname, "index.ts"), "utf8");

    expect(source).toContain("buildRecordingPreflightPrompt");
    expect(source).toContain("buildRecordingPreflightPerspectivePrompt");
    expect(source).toContain("buildRecordingPreflightAssessmentSchema");
    expect(source).toContain("buildRecordingPreflightPerspectiveSchema");
    expect(source).toContain("Promise.all");
    expect(source).toContain("perspectiveAssessment");
    expect(source.match(/temperature: 0/g)).toHaveLength(2);
  });
});
