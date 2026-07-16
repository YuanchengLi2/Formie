import { groupAnalysisSessions, type AnalysisHistoryItem } from "./group-sessions";

const sessions: AnalysisHistoryItem[] = [
  { sessionId: "1", createdAt: "2026-07-15T10:00:00Z", detectedLabel: " Cable Row ", correctedLabel: null, score: 75, priorityCorrectionTitles: ["Elbow path"], comparisonSummary: null, priorityIssueImproved: null },
  { sessionId: "2", createdAt: "2026-07-16T10:00:00Z", detectedLabel: "cable   row", correctedLabel: "FreeMotion Row", score: null, priorityCorrectionTitles: ["Elbow path"], comparisonSummary: "Elbow timing improved.", priorityIssueImproved: true },
  { sessionId: "3", createdAt: "2026-07-17T10:00:00Z", detectedLabel: "freemotion row", correctedLabel: null, score: 84, priorityCorrectionTitles: ["Torso control"], comparisonSummary: null, priorityIssueImproved: null },
];

describe("groupAnalysisSessions", () => {
  it("groups exercise variations by the AI-assigned movement family", () => {
    const familySessions = [
      { ...sessions[0], sessionId: "press-1", detectedLabel: "Barbell Bench Press", exerciseFamily: "press" },
      { ...sessions[0], sessionId: "press-2", detectedLabel: "Incline Dumbbell Press", exerciseFamily: "press" },
      { ...sessions[0], sessionId: "squat-1", detectedLabel: "Goblet Squat", exerciseFamily: "squat" },
    ] as unknown as AnalysisHistoryItem[];

    const groups = groupAnalysisSessions(familySessions);
    expect(groups.map((group) => [group.key, group.label, group.sessions.length])).toEqual([
      ["press", "Press", 2],
      ["squat", "Squat", 1],
    ]);
  });

  it("uses the movement family instead of splitting exact label variations", () => {
    const groups = groupAnalysisSessions(sessions);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Row");
    expect(groups[0].sessions.map((session) => session.sessionId)).toEqual(["3", "2", "1"]);
  });

  it("excludes null scores while preserving recurring corrections and improvements", () => {
    const group = groupAnalysisSessions(sessions)[0];
    expect(group.scoreTrend).toEqual([
      { sessionId: "3", createdAt: "2026-07-17T10:00:00Z", score: 84 },
      { sessionId: "1", createdAt: "2026-07-15T10:00:00Z", score: 75 },
    ]);
    expect(group.improvements).toEqual(["Elbow timing improved."]);
    expect(group.recurringCorrections).toEqual([{ title: "Elbow path", count: 2 }]);
  });
});
