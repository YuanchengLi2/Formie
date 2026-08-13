import { countAnalysisSentences, limitAnalysisSentences, segmentAnalysisSentences } from "./sentences";

describe("analysis sentence segmentation", () => {
  it("does not split decimal timestamps", () => {
    expect(segmentAnalysisSentences("Pressure moved forward at 1.4 seconds. Your heels then rose." )).toEqual([
      "Pressure moved forward at 1.4 seconds.",
      "Your heels then rose.",
    ]);
  });

  it("preserves abbreviations and rep notation", () => {
    expect(segmentAnalysisSentences("E.g. rep 2 stayed centered. Rep 3 shifted forward." )).toHaveLength(2);
  });

  it("treats text without final punctuation as one complete segment", () => {
    expect(segmentAnalysisSentences("Keep heel pressure through the ascent")).toEqual(["Keep heel pressure through the ascent"]);
  });

  it("normalizes duplicate whitespace and safely limits complete coaching sentences", () => {
    const value = "Your heels rose at full depth.   Pressure moved toward your toes on reps 1 and 2. The lift was clearest at 1.4 seconds. Extra.";
    expect(countAnalysisSentences(value)).toBe(4);
    expect(limitAnalysisSentences(value, 3)).toBe("Your heels rose at full depth. Pressure moved toward your toes on reps 1 and 2. The lift was clearest at 1.4 seconds.");
  });

  it("does not invent a numbered sentence from the malformed 1.4 regression", () => {
    const broken = "Weight shifted forward onto your toes near full depth around 1. 4 seconds and 3.";
    expect(segmentAnalysisSentences(broken)).toEqual([
      "Weight shifted forward onto your toes near full depth around 1.",
      "4 seconds and 3.",
    ]);
  });
});
