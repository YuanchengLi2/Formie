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
    expect(screen.getByText("Record any movement. FORM identifies it and coaches what it can actually see.")).toBeTruthy();
    expect(screen.getByText("Made for real sets")).toBeTruthy();
  });

  it("shows recent analyses when history exists", async () => {
    const onOpenSession = jest.fn();
    const screen = await render(
      <HomeScreen
        onRecord={jest.fn()}
        onOpenSession={onOpenSession}
        recentAnalyses={[{ sessionId: "session-1", label: "FreeMotion Row", createdAt: "2026-07-15T10:00:00Z", score: 86 }]}
      />,
    );
    expect(screen.getByText("FreeMotion Row")).toBeTruthy();
    await fireEvent.press(screen.getByText("86 / 100"));
    expect(onOpenSession).toHaveBeenCalledWith("session-1");
  });
});
