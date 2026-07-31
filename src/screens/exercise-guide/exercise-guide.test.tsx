import { fireEvent, render } from "@testing-library/react-native";

import { ExerciseGuideScreen } from "./index";

const guide = {
  exercise: { catalogExerciseId: 88, canonicalName: "One-Arm Dumbbell Row", family: "row" as const },
  setup: ["Brace one hand on a stable bench."],
  execution: ["Drive the working elbow toward your hip."],
  safety: ["Keep the supporting surface from sliding."],
  cameraPlacement: ["Place the phone far enough away to keep your full body and bench visible."],
  tutorial: {
    videoId: "dQw4w9WgXcQ",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    title: "One-arm dumbbell row tutorial",
    channel: "Trusted Coach",
    whyChosen: "Shows setup and the full movement clearly.",
    thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    searchAttributionHtml: null,
  },
};

describe("ExerciseGuideScreen", () => {
  it("shows setup, execution, and safety before recording", async () => {
    const screen = await render(
      <ExerciseGuideScreen
        exerciseName="One-Arm Dumbbell Row"
        guide={guide}
        loading={false}
        error={null}
        onRetry={jest.fn()}
        onContinue={jest.fn()}
        onOpenSpaceHelp={jest.fn()}
        onOpenTutorial={jest.fn()}
      />,
    );

    expect(screen.getByText("Setup")).toBeTruthy();
    expect(screen.getByText("How to perform it")).toBeTruthy();
    expect(screen.getByText("Safety")).toBeTruthy();
    expect(screen.getByText("Camera placement")).toBeTruthy();
    expect(screen.getByText("Drive the working elbow toward your hip.")).toBeTruthy();
    expect(screen.queryByText(
      "Review the movement, then position your camera so the full set stays visible.",
    )).toBeNull();
    expect(screen.getByLabelText("Play One-arm dumbbell row tutorial on YouTube")).toBeTruthy();
    expect(screen.getAllByLabelText("Row movement illustration").length).toBeGreaterThan(0);
  });

  it("opens the selected YouTube tutorial", async () => {
    const onOpenTutorial = jest.fn();
    const screen = await render(
      <ExerciseGuideScreen
        exerciseName="One-Arm Dumbbell Row"
        guide={guide}
        loading={false}
        error={null}
        onRetry={jest.fn()}
        onContinue={jest.fn()}
        onOpenSpaceHelp={jest.fn()}
        onOpenTutorial={onOpenTutorial}
      />,
    );
    fireEvent.press(screen.getByLabelText("Play One-arm dumbbell row tutorial on YouTube"));
    expect(onOpenTutorial).toHaveBeenCalledWith(guide.tutorial);
  });

  it("allows retry or continuing with generic tips when guide generation fails", async () => {
    const onRetry = jest.fn();
    const onContinue = jest.fn();
    const screen = await render(
      <ExerciseGuideScreen
        exerciseName="One-Arm Dumbbell Row"
        guide={null}
        loading={false}
        error="Guide unavailable"
        onRetry={onRetry}
        onContinue={onContinue}
        onOpenSpaceHelp={jest.fn()}
        onOpenTutorial={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByLabelText("Retry guide"));
    await fireEvent.press(screen.getByLabelText("Continue to Camera Tips"));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("lets the user continue to camera tips while the setup guide is still loading", async () => {
    const onContinue = jest.fn();
    const screen = await render(
      <ExerciseGuideScreen
        exerciseName="Jefferson Curl"
        guide={null}
        loading
        error={null}
        onRetry={jest.fn()}
        onContinue={onContinue}
        onOpenSpaceHelp={jest.fn()}
        onOpenTutorial={jest.fn()}
      />,
    );

    expect(screen.getByLabelText("Loading exercise guide")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Continue to Camera Tips"));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
