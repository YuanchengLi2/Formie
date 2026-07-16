import { evidencePreviewMs } from "./evidence-timestamp";

describe("evidencePreviewMs", () => {
  it("uses the model-selected peak frame and falls back to the interval midpoint for old results", () => {
    expect(evidencePreviewMs({ startMs: 1_000, peakMs: 1_420, endMs: 1_700 })).toBe(1_420);
    expect(evidencePreviewMs({ startMs: 1_000, endMs: 1_700 })).toBe(1_350);
  });
});
