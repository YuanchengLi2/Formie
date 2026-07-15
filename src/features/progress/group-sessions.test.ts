import { groupAnalysisSessions, type AnalysisHistoryItem } from "./group-sessions";

const sessions: AnalysisHistoryItem[] = [
  { sessionId: "1", createdAt: "2026-07-15T10:00:00Z", detectedLabel: " Cable Row ", correctedLabel: null, score: 75, priorityCorrectionTitles: ["Elbow path"], comparisonSummary: null, priorityIssueImproved: null },
  { sessionId: "2", createdAt: "2026-07-16T10:00:00Z", detectedLabel: "cable   row", correctedLabel: "FreeMotion Row", score: null, priorityCorrectionTitles: ["Elbow path"], comparisonSummary: "Elbow timing improved.", priorityIssueImproved: true },
  { sessionId: "3", createdAt: "2026-07-17T10:00:00Z", detectedLabel: "freemotion row", correctedLabel: null, score: 84, priorityCorrectionTitles: ["Torso control"], comparisonSummary: null, priorityIssueImproved: null },
];

describe("groupAnalysisSessions", () => {
  it("uses corrections and normalizes case and spacing", () => {
    const groups = groupAnalysisSessions(sessions);
    expect(groups).toHaveLength(2);
    expect(groups.find((group) => group.label === "FreeMotion Row")?.sessions.map((session) => session.sessionId)).toEqual(["3", "2"]);
  });

  it("excludes null scores while preserving recurring corrections and improvements", () => {
    const group = groupAnalysisSessions(sessions).find((item) => item.label === "FreeMotion Row");
    expect(group?.scoreTrend).toEqual([{ sessionId: "3", createdAt: "2026-07-17T10:00:00Z", score: 84 }]);
    expect(group?.improvements).toEqual(["Elbow timing improved."]);
    expect(group?.recurringCorrections).toEqual([]);
    expect(groupAnalysisSessions(sessions)[1].recurringCorrections).toEqual([{ title: "Elbow path", count: 1 }]);
  });
});
