import { evidencePreviewMs, formatPointAdvice } from "./evidence-timestamp";

describe("evidencePreviewMs", () => {
  it("uses the model-selected peak frame and falls back to the interval midpoint for old results", () => {
    expect(evidencePreviewMs({ startMs: 1_000, peakMs: 1_420, endMs: 1_700 })).toBe(1_420);
    expect(evidencePreviewMs({ startMs: 1_000, endMs: 1_700 })).toBe(1_350);
  });
});

describe("formatPointAdvice", () => {
  it("adds the authoritative peak timestamp and removes a duplicated model timestamp", () => {
    expect(formatPointAdvice({ startMs: 7_000, peakMs: 8_350, visualEvidence: "Knees move inward.", coachingNote: "At 0:09, Your knees move inward. Keep each knee over the second toe." }))
      .toBe("At 0:08, your knees move inward. Keep each knee over the second toe.");
  });

  it("falls back to visible evidence for legacy analyses", () => {
    expect(formatPointAdvice({ startMs: 1_000, visualEvidence: "The bar tilts left." })).toBe("At 0:01, the bar tilts left.");
  });
});
