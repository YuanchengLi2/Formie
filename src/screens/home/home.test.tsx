import { fireEvent, render } from "@testing-library/react-native";

import { emptyHomeHeroHeight, HomeScreen } from "./index";

const metrics = {
  currentStreakDays: 4,
  averageScore: 83,
  bestExercise: { family: "row" as const, label: "Row", averageScore: 88, scoredSessions: 5 },
  biggestImprovement: { family: "squat" as const, label: "Squat", points: 12, firstScore: 70, latestScore: 82 },
};

describe("HomeScreen", () => {
  it.each([
    [9, 10, "ready", "9/10", "9 of 10 analyses remaining"],
    [0, 10, "ready", "0/10", "0 of 10 analyses remaining"],
    [null, 10, "checking", "—/10", "Analysis balance is being checked"],
    [0, 10, "expired", "0/10", "Subscription required. 0 of 10 analyses available"],
    [0, 10, "purchase", "Purchase a subscription to use the app", "Purchase a subscription to use the app"],
  ] as const)("shows a compact quota bar for %s/%s %s", async (remaining, limit, status, fraction, label) => {
    const screen = await render(<HomeScreen analysisRemaining={remaining} analysisLimit={limit} analysisStatus={status} />);
    expect(screen.getByText(fraction)).toBeTruthy();
    expect(screen.getByLabelText(label)).toBeTruthy();
    expect(screen.queryByText(/analyses left|resets sep/i)).toBeNull();
  });

  it("leaves recording exclusively to the permanent center tab", async () => {
    const screen = await render(<HomeScreen />);

    expect(screen.queryByLabelText("Record an Exercise")).toBeNull();
    expect(screen.queryByText("Search exercises")).toBeNull();
    expect(screen.queryByText("Choose Exercise")).toBeNull();

  });

  it("explains that recognition happens automatically", async () => {
    const screen = await render(<HomeScreen />);
    expect(screen.getByText("Record a set. Get clear coaching on what changed.")).toBeTruthy();
    expect(screen.queryByText("Made for real sets")).toBeNull();
  });

  it("uses the expanded first-recording home only after history resolves empty", async () => {
    const empty = await render(<HomeScreen historyResolved />);
    expect(empty.getByLabelText("First recording hero")).toBeTruthy();
    expect(empty.queryByText("Recent")).toBeNull();

    const loading = await render(<HomeScreen historyResolved={false} />);
    expect(loading.queryByLabelText("First recording hero")).toBeNull();
    expect(loading.getByLabelText("Loading recording history")).toBeTruthy();
  });

  it("keeps the first-recording hero compact on short phones", () => {
    expect(emptyHomeHeroHeight(320, 568)).toBe(220);
    expect(emptyHomeHeroHeight(375, 667)).toBe(226);
    expect(emptyHomeHeroHeight(430, 932)).toBe(300);
  });

  it("keeps the first-recording artwork without a duplicate recording button", async () => {
    const screen = await render(<HomeScreen />);
    const artwork = screen.getByTestId("first-recording-artwork");
    expect(artwork).toBeTruthy();
    expect(screen.queryByTestId("first-recording-cta")).toBeNull();
  });

  it("shows recent analyses when history exists", async () => {
    const onOpenSession = jest.fn();
    const screen = await render(
      <HomeScreen
        onOpenSession={onOpenSession}
        metrics={metrics}
        now={new Date("2026-07-18T10:00:00Z")}
        recentAnalyses={[{ sessionId: "session-1", status: "complete", label: "FreeMotion Row", createdAt: "2026-07-15T10:00:00Z", score: 86, priorityCorrectionTitles: ["Keep your torso steady"] }]}
      />,
    );
    expect(screen.getAllByText("FreeMotion Row").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Keep your torso steady").length).toBeGreaterThan(0);
    expect(screen.getByText("1 analysis this week")).toBeTruthy();
    expect(screen.getByText("Ask Formie Coach")).toBeTruthy();
    expect(screen.getByText("View Progress")).toBeTruthy();
    expect(screen.getByTestId("progress-metrics-horizontal")).toBeTruthy();
    expect(screen.getByText("4 days")).toBeTruthy();
    await fireEvent.press(screen.getByText("86 / 100"));
    expect(onOpenSession).toHaveBeenCalledWith("session-1", "complete");
  });

  it("makes the top bar and dashboard shortcuts more prominent", async () => {
    const screen = await render(
      <HomeScreen
        recentAnalyses={[{ sessionId: "session-1", status: "complete", label: "FreeMotion Row", createdAt: "2026-07-15T10:00:00Z", score: 86 }]}
      />,
    );

    expect(screen.getByTestId("home-top-bar")).toHaveStyle({ minHeight: 68 });
    expect(screen.getByLabelText("Formie logo")).toHaveStyle({ width: 56, height: 56 });
    expect(screen.getByTestId("home-coach-action")).toHaveStyle({ minHeight: 88 });
    expect(screen.getByTestId("home-progress-action")).toHaveStyle({ minHeight: 88 });
    expect(screen.getByText("Ask Formie Coach")).toHaveStyle({ fontSize: 18 });
    expect(screen.getByText("View Progress")).toHaveStyle({ fontSize: 18 });
    expect(screen.getByLabelText("Formie Coach icon")).toHaveStyle({ width: 32, height: 32 });
    expect(screen.getByLabelText("View progress icon")).toHaveStyle({ width: 32, height: 32 });
  });

  it("surfaces an interrupted analysis so it can resume", async () => {
    const onOpenSession = jest.fn();
    const screen = await render(
      <HomeScreen
        onOpenSession={onOpenSession}
        recentAnalyses={[{ sessionId: "processing-1", status: "processing", label: "Analyzing set", createdAt: "2026-07-16T10:00:00Z", score: null }]}
      />,
    );

    expect(screen.getAllByText("Analysis in progress").length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByText("Continue"));
    expect(onOpenSession).toHaveBeenCalledWith("processing-1", "processing");
  });

  it("shows shared metric empty states below the introduction before the first recording", async () => {
    const screen = await render(<HomeScreen metrics={null} />);
    expect(screen.getByTestId("progress-metrics-horizontal")).toBeTruthy();
    expect(screen.getByText("Start today")).toBeTruthy();
    expect(screen.getByText("Need 2 scores")).toBeTruthy();
  });

  it("keeps the latest failed recording on Home with a retry destination", async () => {
    const onOpenSession = jest.fn();
    const screen = await render(
      <HomeScreen
        onOpenSession={onOpenSession}
        recentAnalyses={[{ sessionId: "failed-1", status: "failed", label: "Analysis needs retry", createdAt: "2026-07-25T02:19:00Z", score: null }]}
      />,
    );

    expect(screen.getAllByText("Analysis needs retry").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Retry analysis").length).toBeGreaterThan(0);
    await fireEvent.press(screen.getAllByText("Retry")[0]);
    expect(onOpenSession).toHaveBeenCalledWith("failed-1", "failed");
  });
});
