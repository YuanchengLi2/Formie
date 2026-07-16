import { fireEvent, render } from "@testing-library/react-native";

import { HomeScreen } from "./index";

describe("HomeScreen", () => {
  it("centers the experience on recording without exercise selection", async () => {
    const onRecord = jest.fn();
    const screen = await render(<HomeScreen onRecord={onRecord} />);

    expect(screen.getByLabelText("Record an Exercise")).toBeTruthy();
    expect(screen.queryByText("Search exercises")).toBeNull();
    expect(screen.queryByText("Choose Exercise")).toBeNull();

    await fireEvent.press(screen.getByLabelText("Record an Exercise"));
    expect(onRecord).toHaveBeenCalledTimes(1);
  });

  it("explains that recognition happens automatically", async () => {
    const screen = await render(<HomeScreen onRecord={jest.fn()} />);
    expect(screen.getByText("Record a set. Get clear coaching on what changed.")).toBeTruthy();
    expect(screen.queryByText("Made for real sets")).toBeNull();
  });

  it("uses the expanded first-recording home only after history resolves empty", async () => {
    const empty = await render(<HomeScreen onRecord={jest.fn()} historyResolved />);
    expect(empty.getByLabelText("First recording hero")).toBeTruthy();
    expect(empty.queryByText("Recent")).toBeNull();

    const loading = await render(<HomeScreen onRecord={jest.fn()} historyResolved={false} />);
    expect(loading.queryByLabelText("First recording hero")).toBeNull();
    expect(loading.getByLabelText("Loading recording history")).toBeTruthy();
  });

  it("shows recent analyses when history exists", async () => {
    const onOpenSession = jest.fn();
    const screen = await render(
      <HomeScreen
        onRecord={jest.fn()}
        onOpenSession={onOpenSession}
        recentAnalyses={[{ sessionId: "session-1", status: "complete", label: "FreeMotion Row", createdAt: "2026-07-15T10:00:00Z", score: 86 }]}
      />,
    );
    expect(screen.getByText("FreeMotion Row")).toBeTruthy();
    await fireEvent.press(screen.getByText("86 / 100"));
    expect(onOpenSession).toHaveBeenCalledWith("session-1", "complete");
  });

  it("surfaces an interrupted analysis so it can resume", async () => {
    const onOpenSession = jest.fn();
    const screen = await render(
      <HomeScreen
        onRecord={jest.fn()}
        onOpenSession={onOpenSession}
        recentAnalyses={[{ sessionId: "processing-1", status: "processing", label: "Analyzing set", createdAt: "2026-07-16T10:00:00Z", score: null }]}
      />,
    );

    expect(screen.getByText("Analysis in progress")).toBeTruthy();
    await fireEvent.press(screen.getByText("Continue"));
    expect(onOpenSession).toHaveBeenCalledWith("processing-1", "processing");
  });
});
