import { render } from "@testing-library/react-native";

import { ProgressMetricsPanel } from "./progress-metrics";

const metrics = {
  currentStreakDays: 4,
  averageScore: 83,
  bestExercise: { family: "row" as const, label: "Row", averageScore: 88, scoredSessions: 5 },
  biggestImprovement: { family: "squat" as const, label: "Squat", points: 12, firstScore: 70, latestScore: 82 },
};

describe("ProgressMetricsPanel", () => {
  it("renders the shared four rewards as a Progress grid", async () => {
    const screen = await render(<ProgressMetricsPanel layout="grid" metrics={metrics} />);
    expect(screen.getByTestId("progress-metrics-grid")).toBeTruthy();
    expect(screen.getByText("Current streak")).toBeTruthy();
    expect(screen.getByText("Average score")).toBeTruthy();
    expect(screen.getByText("Best exercise")).toBeTruthy();
    expect(screen.getByText("Biggest improvement")).toBeTruthy();
    expect(screen.getByLabelText("Current streak icon")).toHaveStyle({ width: 32, height: 32 });
    expect(screen.getByLabelText("Average score icon")).toHaveStyle({ width: 32, height: 32 });
    expect(screen.getByLabelText("Best exercise icon")).toHaveStyle({ width: 32, height: 32 });
    expect(screen.getByLabelText("Biggest improvement icon")).toHaveStyle({ width: 32, height: 32 });
    expect(screen.getByTestId("progress-metric-streak")).toHaveStyle({ minHeight: 112 });
  });

  it("renders the same values in the compact Home row", async () => {
    const screen = await render(<ProgressMetricsPanel layout="horizontal" metrics={metrics} />);
    expect(screen.getByTestId("progress-metrics-horizontal")).toBeTruthy();
    expect(screen.getByText("4 days")).toBeTruthy();
    expect(screen.getByText("Row · 88 avg")).toBeTruthy();
    expect(screen.getByText("Squat · +12")).toBeTruthy();
    expect(screen.getByTestId("progress-metric-average")).toHaveStyle({ minHeight: 104, width: 176 });
  });
});
