import { fireEvent, render } from "@testing-library/react-native";

import type { AnalysisHistoryGroup } from "@/features/progress/group-sessions";

import { ProgressScreen } from ".";

const group: AnalysisHistoryGroup = {
  key: "row",
  label: "Row",
  exerciseFamily: "row",
  sessions: [
    { sessionId: "s1", createdAt: "2026-07-15T10:00:00Z", detectedLabel: "Cable Row", correctedLabel: null, score: 82, priorityCorrectionTitles: ["Elbow path"], comparisonSummary: "Control improved.", priorityIssueImproved: true },
    { sessionId: "s0", createdAt: "2026-07-12T10:00:00Z", detectedLabel: "Cable Row", correctedLabel: null, score: 74, priorityCorrectionTitles: ["Elbow path"], comparisonSummary: null, priorityIssueImproved: null },
  ],
  scoreTrend: [
    { sessionId: "s1", createdAt: "2026-07-15T10:00:00Z", score: 82 },
    { sessionId: "s0", createdAt: "2026-07-12T10:00:00Z", score: 74 },
  ],
  recurringCorrections: [{ title: "Elbow path", count: 1 }],
  improvements: ["Control improved."],
};

describe("ProgressScreen", () => {
  it("keeps a bounded blank movement graph when there is no exercise data", async () => {
    const screen = await render(<ProgressScreen groups={[]} onOpenSession={jest.fn()} onRecord={jest.fn()} />);
    expect(screen.getByText("Movement Quality")).toBeTruthy();
    expect(screen.getByLabelText("No movement quality data yet")).toBeTruthy();
    expect(screen.queryByText("Saved analyses")).toBeNull();
  });

  it("renders automatic exercise history and opens a result", async () => {
    const onOpen = jest.fn();
    const screen = await render(<ProgressScreen groups={[group]} onOpenSession={onOpen} />);
    expect(screen.getByText("Row")).toBeTruthy();
    expect(screen.getByText("Movement Quality")).toBeTruthy();
    expect(screen.getByText("+8 average points")).toBeTruthy();
    expect(screen.getByText("Recurring: Elbow path")).toBeTruthy();
    expect(screen.getByText("Control improved.")).toBeTruthy();
    expect(screen.getByLabelText("Movement quality trend from 74 to 82")).toBeTruthy();
    expect(screen.queryByText("Saved analyses")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Open analysis from 7/12/2026"));
    expect(onOpen).toHaveBeenCalledWith("s0");
    await fireEvent.press(screen.getByLabelText("Open analysis from 7/15/2026"));
    expect(onOpen).toHaveBeenCalledWith("s1");
  });
});
