import { ANALYSIS_HISTORY_STATUSES, fetchAnalysisHistory, fetchProgressMetrics } from "./api";

const mockHistoryLimit = jest.fn().mockResolvedValue({ data: [], error: null });
const mockHistoryOrder = jest.fn(() => ({ limit: mockHistoryLimit }));
const mockHistoryStatuses = jest.fn(() => ({ order: mockHistoryOrder }));
jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({ in: mockHistoryStatuses }),
    }),
  },
}));

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

it("shows the persisted evidence-calibrated score without applying another client cap", async () => {
  const history = await fetchAnalysisHistory({
    query: async () => ({
      data: [{
        id: "strict-score",
        status: "complete",
        created_at: "2026-07-26T10:00:00Z",
        detected_label: "Skull Crushers",
        corrected_label: null,
        exercise_family: "triceps",
        analysis_results: {
          score: 94,
          priority_corrections: [{
            title: "Elbow flare",
            detail: "The elbows flare on the final repetitions.",
            severity: "important",
            evidence: [{ peakMs: 1_000 }],
          }],
          comparison: null,
        },
      }],
      error: null,
    }),
  });

  expect(history[0].score).toBe(94);
});

it("includes failed saved recordings in owner-visible history", async () => {
  expect(ANALYSIS_HISTORY_STATUSES).toEqual(
    expect.arrayContaining(["processing", "complete", "partial", "unable", "failed"]),
  );
});

it("fetches the authenticated all-history metrics RPC using the device timezone", async () => {
  const rpc = jest.fn().mockResolvedValue({
    data: {
      currentStreakDays: 2,
      averageScore: 80,
      bestExercise: { family: "row", label: "Row", averageScore: 85, scoredSessions: 4 },
      biggestImprovement: null,
    },
    error: null,
  });

  await expect(fetchProgressMetrics({ timeZone: "America/New_York", rpc })).resolves.toMatchObject({
    currentStreakDays: 2,
    averageScore: 80,
  });
  expect(rpc).toHaveBeenCalledWith("get_progress_metrics", { requested_timezone: "America/New_York" });
});

it("falls back to UTC when the device does not expose an IANA timezone", async () => {
  const rpc = jest.fn().mockResolvedValue({
    data: { currentStreakDays: 0, averageScore: null, bestExercise: null, biggestImprovement: null },
    error: null,
  });

  await fetchProgressMetrics({ timeZone: "", rpc });
  expect(rpc).toHaveBeenCalledWith("get_progress_metrics", { requested_timezone: "UTC" });
});
