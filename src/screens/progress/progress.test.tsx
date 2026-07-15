import { fireEvent, render } from "@testing-library/react-native";

import type { AnalysisHistoryGroup } from "@/features/progress/group-sessions";

import { ProgressScreen } from ".";

const group: AnalysisHistoryGroup = {
  key: "cable row",
  label: "Cable Row",
  sessions: [{ sessionId: "s1", createdAt: "2026-07-15T10:00:00Z", detectedLabel: "Cable Row", correctedLabel: null, score: 82, priorityCorrectionTitles: ["Elbow path"], comparisonSummary: "Control improved.", priorityIssueImproved: true }],
  scoreTrend: [{ sessionId: "s1", createdAt: "2026-07-15T10:00:00Z", score: 82 }],
  recurringCorrections: [{ title: "Elbow path", count: 1 }],
  improvements: ["Control improved."],
};

describe("ProgressScreen", () => {
  it("renders automatic exercise history and opens a result", async () => {
    const onOpen = jest.fn();
    const screen = await render(<ProgressScreen groups={[group]} onOpenSession={onOpen} />);
    expect(screen.getByText("Cable Row")).toBeTruthy();
    expect(screen.getByText("Movement quality 82")).toBeTruthy();
    expect(screen.getByText("Recurring: Elbow path")).toBeTruthy();
    expect(screen.getByText("Control improved.")).toBeTruthy();
    await fireEvent.press(screen.getByText("View Analysis"));
    expect(onOpen).toHaveBeenCalledWith("s1");
  });
});
