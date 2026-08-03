type ScoreFinding = { severity: "note" | "important" | "high"; evidence: readonly unknown[] };

function proportionalFloor(findings: readonly ScoreFinding[]): number {
  const high = findings.filter((finding) => finding.severity === "high");
  const important = findings.filter((finding) => finding.severity === "important");
  const recurringHigh = high.filter((finding) => finding.evidence.length > 1);
  if (high.length >= 2) return 0;
  if (recurringHigh.length === 1) return 68;
  if (high.length === 1) return 72;
  if (important.length >= 3) return 74;
  if (important.length === 2) return 78;
  if (important.length === 1) return 82;
  if (findings.length > 0) return 86;
  return 90;
}

export function calibratedTechniqueScore(rawScore: number, findings: readonly ScoreFinding[]): number {
  return Math.max(Math.max(0, Math.min(100, Math.round(rawScore))), proportionalFloor(findings));
}
