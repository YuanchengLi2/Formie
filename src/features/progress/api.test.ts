import { fetchAnalysisHistory } from "./api";

it("maps owner-visible completed analysis rows into history items", async () => {
  const history = await fetchAnalysisHistory({
    query: async () => ({
      data: [{
        id: "s1",
        status: "processing",
        created_at: "2026-07-15T10:00:00Z",
        detected_label: "Cable Row",
        corrected_label: null,
        pinned_at: "2026-07-16T12:00:00Z",
        exercise_family: "row",
        analysis_results: { score: 82, priority_corrections: [{ title: "Elbow path" }], comparison: { summary: "Timing improved.", priorityIssueImproved: true } },
      }],
      error: null,
    }),
  });
  expect(history).toEqual([{ sessionId: "s1", status: "processing", createdAt: "2026-07-15T10:00:00Z", detectedLabel: "Cable Row", correctedLabel: null, pinnedAt: "2026-07-16T12:00:00Z", exerciseFamily: "row", score: 82, priorityCorrectionTitles: ["Elbow path"], comparisonSummary: "Timing improved.", priorityIssueImproved: true }]);
});
