import { fireEvent, render } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ExerciseGuideScreen } from "./index";

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
};

function renderGuide(element: ReactElement) {
  return render(<SafeAreaProvider initialMetrics={safeAreaMetrics}>{element}</SafeAreaProvider>);
}

const guide = {
  exercise: { catalogExerciseId: 88, canonicalName: "One-Arm Dumbbell Row", family: "row" as const },
  setup: ["Brace one hand on a stable bench."],
  execution: ["Drive the working elbow toward your hip."],
  safety: ["Keep the supporting surface from sliding."],
  cameraPlacement: ["Side view", "Hip height", "Full body visible"],
  tutorial: {
    source: "youtube_data_api_v3" as const,
    videoId: "dQw4w9WgXcQ",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    title: "One-arm dumbbell row tutorial",
    channel: "Trusted Coach",
    channelId: "channel-1",
    thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    durationSeconds: 360,
    verifiedAt: "2026-09-01T12:00:00.000Z",
    eligibilityVersion: "youtube-tutorial-v1",
  },
};

describe("ExerciseGuideScreen", () => {
  it("shows the live guide in the reference hierarchy and switches one instruction set at a time", async () => {
    const onBack = jest.fn();
    const onOpenSpaceHelp = jest.fn();
    const screen = await renderGuide(
      <ExerciseGuideScreen
        exerciseName="One-Arm Dumbbell Row"
        guide={guide}
        loading={false}
        error={null}
        onBack={onBack}
        onRetry={jest.fn()}
        onContinue={jest.fn()}
        onOpenSpaceHelp={onOpenSpaceHelp}
        onOpenTutorial={jest.fn()}
      />,
    );

    expect(screen.getByText("Exercise Guide")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Go back from Exercise Guide"));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByText("One-Arm Dumbbell Row")).toBeTruthy();
    expect(screen.getByText("Row")).toBeTruthy();
    expect(screen.getByText("Setup")).toBeTruthy();
    expect(screen.getByText("Form")).toBeTruthy();
    expect(screen.queryByText("Safety")).toBeNull();
    expect(screen.getByText("Drive the working elbow toward your hip.")).toBeTruthy();
    expect(screen.queryByText("Brace one hand on a stable bench.")).toBeNull();

    await fireEvent.press(screen.getByLabelText("Show setup steps"));
    expect(screen.getByText("Brace one hand on a stable bench.")).toBeTruthy();
    expect(screen.queryByText("Drive the working elbow toward your hip.")).toBeNull();

    expect(screen.queryByText("Keep the supporting surface from sliding.")).toBeNull();

    expect(screen.getByText("Camera Setup")).toBeTruthy();
    expect(screen.getByText("Side view  ·  Hip height  ·  Full body visible")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Open camera setup help"));
    expect(onOpenSpaceHelp).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Continue to Camera")).toBeTruthy();
    expect(screen.getByLabelText("Play One-arm dumbbell row tutorial on YouTube")).toBeTruthy();
    expect(screen.getByText("YouTube")).toBeTruthy();
    expect(screen.getByText("Watch on YouTube")).toBeTruthy();
    expect(screen.getByTestId("exercise-guide-tabs").props.style).toEqual(expect.objectContaining({ minHeight: 44 }));
    expect(StyleSheet.flatten(screen.getByTestId("exercise-guide-steps").props.style)).toMatchObject({ gap: 16 });
    expect(StyleSheet.flatten(screen.getByTestId("exercise-guide-steps").props.style)).not.toHaveProperty("borderWidth");
    expect(StyleSheet.flatten(screen.getByTestId("exercise-guide-step-0").props.style)).toMatchObject({ paddingVertical: 0 });
    expect(StyleSheet.flatten(screen.getByTestId("exercise-guide-step-0").props.style)).not.toHaveProperty("minHeight");
    expect(StyleSheet.flatten(screen.getByText("Brace one hand on a stable bench.").props.style)).toMatchObject({ fontSize: 15, lineHeight: 22 });
    expect(screen.queryByTestId("exercise-guide-step-number-bubble-0")).toBeNull();
    expect(screen.getByTestId("exercise-guide-camera-card").props.style).toEqual(expect.objectContaining({ minHeight: 60 }));
  });

  it("opens the selected YouTube tutorial", async () => {
    const onOpenTutorial = jest.fn();
    const screen = await renderGuide(
      <ExerciseGuideScreen
        exerciseName="One-Arm Dumbbell Row"
        guide={guide}
        loading={false}
        error={null}
        onBack={jest.fn()}
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
    const screen = await renderGuide(
      <ExerciseGuideScreen
        exerciseName="One-Arm Dumbbell Row"
        guide={null}
        loading={false}
        error="Guide unavailable"
        onBack={jest.fn()}
        onRetry={onRetry}
        onContinue={onContinue}
        onOpenSpaceHelp={jest.fn()}
        onOpenTutorial={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByLabelText("Retry guide"));
    await fireEvent.press(screen.getByLabelText("Continue to Camera"));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("lets the user continue to camera tips while the setup guide is still loading", async () => {
    const onContinue = jest.fn();
    const screen = await renderGuide(
      <ExerciseGuideScreen
        exerciseName="Jefferson Curl"
        guide={null}
        loading
        error={null}
        onBack={jest.fn()}
        onRetry={jest.fn()}
        onContinue={onContinue}
        onOpenSpaceHelp={jest.fn()}
        onOpenTutorial={jest.fn()}
      />,
    );

    expect(screen.getByLabelText("Loading exercise guide")).toBeTruthy();
    expect(screen.getByTestId("exercise-guide-skeleton")).toBeTruthy();
    expect(screen.getByTestId("exercise-guide-skeleton-step-0")).toBeTruthy();
    expect(screen.queryByText(/%|seconds remaining|minutes remaining/i)).toBeNull();
    await fireEvent.press(screen.getByLabelText("Continue to Camera"));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
