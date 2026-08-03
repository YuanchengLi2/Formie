import { calibratedTechniqueScore } from "./score-calibration";

const evidence = [{ repNumber: 1 }];

describe("historical evidence-proportional technique scoring", () => {
  it("keeps a technically sound set strong when feedback is one important refinement and one note", () => {
    expect(calibratedTechniqueScore(74, [
      { severity: "important", evidence },
      { severity: "note", evidence },
    ])).toBe(82);
  });

  it("does not raise a score already consistent with the visible findings", () => {
    expect(calibratedTechniqueScore(91, [{ severity: "note", evidence }])).toBe(91);
  });

  it("still permits low scores for several recurring high-severity breakdowns", () => {
    expect(calibratedTechniqueScore(61, [
      { severity: "high", evidence: [evidence[0], { repNumber: 3 }] },
      { severity: "high", evidence: [evidence[0], { repNumber: 4 }] },
    ])).toBe(61);
  });
});
