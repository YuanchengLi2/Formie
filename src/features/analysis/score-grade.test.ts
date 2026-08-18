import { scoreLetterGrade } from "./score-grade";

describe("scoreLetterGrade", () => {
  it.each([
    [100, "A"],
    [90, "A"],
    [89.9, "B"],
    [80, "B"],
    [79, "C"],
    [70, "C"],
    [69, "D"],
    [60, "D"],
    [59, "E"],
    [50, "E"],
    [49, "F"],
    [0, "F"],
  ])("maps %s to %s", (score, grade) => {
    expect(scoreLetterGrade(score)).toBe(grade);
  });
});
