import { fireEvent, render } from "@testing-library/react-native";

import type { AnalysisHistoryGroup } from "@/features/progress/group-sessions";

import { ProgressScreen } from ".";

const group: AnalysisHistoryGroup = {
  key: "row",
  label: "Row",
  exerciseFamily: "row",
  sessions: [
    { sessionId: "s1", status: "complete", createdAt: "2026-07-15T10:00:00Z", detectedLabel: "Cable Row", correctedLabel: null, score: 82, priorityCorrectionTitles: ["Elbow path"], comparisonSummary: "Control improved.", priorityIssueImproved: true },
    { sessionId: "s0", status: "complete", createdAt: "2026-07-12T10:00:00Z", detectedLabel: "Cable Row", correctedLabel: null, score: 74, priorityCorrectionTitles: ["Elbow path"], comparisonSummary: null, priorityIssueImproved: null },
  ],
  scoreTrend: [
    { sessionId: "s1", createdAt: "2026-07-15T10:00:00Z", score: 82 },
    { sessionId: "s0", createdAt: "2026-07-12T10:00:00Z", score: 74 },
  ],
  recurringCorrections: [{ title: "Elbow path", count: 1 }],
  improvements: ["Control improved."],
};

describe("ProgressScreen", () => {
  it("uses search and filters without rendering the movement graph", async () => {
    const screen = await render(<ProgressScreen groups={[]} onOpenSession={jest.fn()} onRecord={jest.fn()} />);
    expect(screen.getByPlaceholderText("Search exercises")).toBeTruthy();
    expect(screen.getByText("All")).toBeTruthy();
    expect(screen.queryByText("Movement Quality")).toBeNull();
  });

  it("renders every saved exercise separately and filters the list", async () => {
    const onOpen = jest.fn();
    const screen = await render(<ProgressScreen groups={[group]} onOpenSession={onOpen} />);
    expect(screen.getAllByText("Cable Row")).toHaveLength(2);
    await fireEvent.press(screen.getByLabelText("Open analysis from 7/12/2026"));
    expect(onOpen).toHaveBeenCalledWith("s0", "complete");
    await fireEvent.press(screen.getByLabelText("Open analysis from 7/15/2026"));
    expect(onOpen).toHaveBeenCalledWith("s1", "complete");
    await fireEvent.changeText(screen.getByPlaceholderText("Search exercises"), "bench");
    expect(screen.queryByText("Cable Row")).toBeNull();
  });

  it("opens row actions and supports pinning and confirmed deletion", async () => {
    const onTogglePin = jest.fn();
    const onDeleteSession = jest.fn();
    const screen = await render(<ProgressScreen groups={[group]} onOpenSession={jest.fn()} onTogglePin={onTogglePin} onDeleteSession={onDeleteSession} />);

    await fireEvent.press(screen.getByLabelText("More options for Cable Row from 7/15/2026"));
    await fireEvent.press(screen.getByText("Pin analysis"));
    expect(onTogglePin).toHaveBeenCalledWith("s1", true);

    await fireEvent.press(screen.getByLabelText("More options for Cable Row from 7/15/2026"));
    await fireEvent.press(screen.getByText("Delete analysis"));
    expect(screen.getByText("Delete this analysis?")).toBeTruthy();
    await fireEvent.press(screen.getByText("Delete permanently"));
    expect(onDeleteSession).toHaveBeenCalledWith("s1");
  });
});
