export type ScoreLetterGrade = "A" | "B" | "C" | "D" | "E" | "F";

export function scoreLetterGrade(score: number): ScoreLetterGrade {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  if (score >= 50) return "E";
  return "F";
}
