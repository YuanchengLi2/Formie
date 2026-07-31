import { progressMetricsSchema, progressMetricsValue } from "./metrics";

describe("progress metrics", () => {
  const payload = progressMetricsSchema.parse({
    currentStreakDays: 4,
    averageScore: 83,
    bestExercise: {
      family: "row",
      label: "Row",
      averageScore: 88,
      scoredSessions: 5,
    },
    biggestImprovement: {
      family: "squat",
      label: "Squat",
      points: 12,
      firstScore: 70,
      latestScore: 82,
    },
  });

  it("accepts the authenticated all-history response", () => {
    expect(progressMetricsSchema.parse(payload)).toEqual(payload);
  });

  it("formats shared reward values and truthful empty states", () => {
    expect(progressMetricsValue(payload, "streak")).toBe("4 days");
    expect(progressMetricsValue(payload, "average")).toBe("83");
    expect(progressMetricsValue(payload, "best")).toBe("Row · 88 avg");
    expect(progressMetricsValue(payload, "improvement")).toBe("Squat · +12");

    expect(progressMetricsValue(null, "streak")).toBe("Start today");
    expect(progressMetricsValue(null, "average")).toBe("—");
    expect(progressMetricsValue(null, "best")).toBe("Not yet");
    expect(progressMetricsValue(null, "improvement")).toBe("Need 2 scores");
  });
});
