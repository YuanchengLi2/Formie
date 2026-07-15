import { fetchAnalysisHistory } from "./api";

it("maps owner-visible completed analysis rows into history items", async () => {
  const history = await fetchAnalysisHistory({
    query: async () => ({
      data: [{
        id: "s1",
        created_at: "2026-07-15T10:00:00Z",
        detected_label: "Cable Row",
        corrected_label: null,
        analysis_results: { score: 82, priority_corrections: [{ title: "Elbow path" }], comparison: { summary: "Timing improved.", priorityIssueImproved: true } },
      }],
      error: null,
    }),
  });
  expect(history).toEqual([{ sessionId: "s1", createdAt: "2026-07-15T10:00:00Z", detectedLabel: "Cable Row", correctedLabel: null, score: 82, priorityCorrectionTitles: ["Elbow path"], comparisonSummary: "Timing improved.", priorityIssueImproved: true }]);
});
