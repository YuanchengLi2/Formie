/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SetDeclarationScreen } from "./index";

const mockUseVideoPlayer = jest.fn((..._args: unknown[]) => ({ loop: false, play: jest.fn() }));

jest.mock("expo-video", () => {
  const { View } = require("react-native");
  return {
    useVideoPlayer: (...args: unknown[]) => mockUseVideoPlayer(...args),
    VideoView: View,
  };
});

const savedUnilateralDeclaration = {
  exercise: { source: "catalog" as const, catalogExerciseId: 88, label: "One-Arm Dumbbell Row" },
  amount: { kind: "reps" as const, value: 8, countScope: "per_side" as const },
  load: { kind: "known" as const, value: 40, unit: "lb" as const, scope: "per_hand" as const },
  side: "left" as const,
  styles: ["paused" as const],
  focusNote: null,
};

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
};

function renderDeclaration(screen: ReactElement) {
  return render(<SafeAreaProvider initialMetrics={safeAreaMetrics}>{screen}</SafeAreaProvider>);
}

describe("SetDeclarationScreen", () => {
  beforeEach(() => {
    mockUseVideoPlayer.mockClear();
  });

  it("shows a server submission error beside the analysis action", async () => {
    const screen = await renderDeclaration(
      <SetDeclarationScreen
        localVideoUri="file:///set.mp4"
        submitError="The saved video could not be queued for reanalysis."
        submitting
        onAnalyze={jest.fn()}
        onRetake={jest.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("The saved video could not be queued for reanalysis.");
    expect(screen.getByLabelText("Submit for Analysis…")).toBeDisabled();
  });

  it("can hide the clip because recording review lives on its own page", async () => {
    const screen = await renderDeclaration(
      <SetDeclarationScreen
        localVideoUri="file:///set.mp4"
        showVideoPreview={false}
        onAnalyze={jest.fn()}
        onRetake={jest.fn()}
      />,
    );

    expect(screen.getByText("Tell Formie what you did")).toBeTruthy();
    expect(screen.queryByLabelText("Recorded set preview")).toBeNull();
    expect(screen.queryByText("FINAL CHECK")).toBeNull();
    expect(screen.queryByText("Choose a side or 45° angle")).toBeNull();
    expect(screen.getByLabelText("Submit for Analysis")).toBeTruthy();
    expect(mockUseVideoPlayer).not.toHaveBeenCalled();
  });

  it("keeps exercise catalog suggestions out of Set Details", async () => {
    const onAnalyze = jest.fn();
    const screen = await renderDeclaration(
      <SetDeclarationScreen
        localVideoUri="file:///set.mp4"
        onAnalyze={onAnalyze}
        onRetake={jest.fn()}
      />,
    );

    await fireEvent.changeText(screen.getByLabelText("Exact exercise"), "single arm row");
    expect(screen.queryByLabelText("Choose One-Arm Dumbbell Row")).toBeNull();
    expect(screen.getByPlaceholderText("Type the exact exercise")).toBeTruthy();
  });

  it("shows a preselected catalog exercise without a duplicate name field", async () => {
    const onChangeExercise = jest.fn();
    const onAnalyze = jest.fn();
    const screen = await renderDeclaration(
      <SetDeclarationScreen
        localVideoUri="file:///set.mp4"
        preselectedExercise={{
          catalogExerciseId: 88,
          canonicalName: "One-Arm Dumbbell Row",
          mechanics: { laterality: "unilateral" },
        }}
        onChangeExercise={onChangeExercise}
        onAnalyze={onAnalyze}
        onRetake={jest.fn()}
      />,
    );

    expect(screen.getByText("One-Arm Dumbbell Row")).toBeTruthy();
    expect(screen.queryByLabelText("Exact exercise")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Change exercise"));
    expect(onChangeExercise).toHaveBeenCalledTimes(1);

    await fireEvent.changeText(screen.getByLabelText("Completed amount"), "8");
    await fireEvent.press(screen.getByLabelText("Count is per side"));
    await fireEvent.press(screen.getByLabelText("Performed on left side"));
    await fireEvent.press(screen.getByLabelText("Unknown load"));
    await fireEvent.press(screen.getByLabelText("Submit for Analysis"));

    expect(onAnalyze).toHaveBeenCalledWith(expect.objectContaining({
      exercise: {
        source: "catalog",
        catalogExerciseId: 88,
        label: "One-Arm Dumbbell Row",
      },
    }));
  });

  it("keeps the heading and actions inside the device safe areas", async () => {
    const screen = await renderDeclaration(
      <SetDeclarationScreen
        localVideoUri="file:///set.mp4"
        onAnalyze={jest.fn()}
        onRetake={jest.fn()}
      />,
    );

    expect(StyleSheet.flatten(screen.getByTestId("set-declaration-scroll").props.contentContainerStyle)).toMatchObject({
      paddingTop: 59,
      paddingBottom: 58,
      paddingHorizontal: 20,
    });
  });

  it("supports reanalysis-specific submit and cancel labels", async () => {
    const onRetake = jest.fn();
    const screen = await renderDeclaration(
      <SetDeclarationScreen
        localVideoUri="file:///saved-set.mp4"
        analyzeLabel="Analyze Again"
        secondaryLabel="Cancel"
        onAnalyze={jest.fn()}
        onRetake={onRetake}
      />,
    );

    expect(screen.getByText("Analyze Again")).toBeTruthy();
    await fireEvent.press(screen.getByText("Cancel"));
    expect(onRetake).toHaveBeenCalledTimes(1);
  });

  it("submits an empty legacy styles list without showing a style selector", async () => {
    const onAnalyze = jest.fn();
    const screen = await renderDeclaration(
      <SetDeclarationScreen
        localVideoUri="file:///set.mp4"
        onAnalyze={onAnalyze}
        onRetake={jest.fn()}
      />,
    );

    await fireEvent.changeText(screen.getByLabelText("Exact exercise"), "One-Arm Dumbbell Row");
    expect(screen.queryByText(/use .*custom exercise/i)).toBeNull();
    await fireEvent.changeText(screen.getByLabelText("Completed amount"), "8");
    await fireEvent.press(screen.getByLabelText("Count is per side"));
    await fireEvent.press(screen.getByLabelText("Performed on left side"));
    await fireEvent.press(screen.getByLabelText("Known weight"));
    await fireEvent.changeText(screen.getByLabelText("Load value"), "40");
    await fireEvent.press(screen.getByLabelText("Load unit pounds"));
    await fireEvent.press(screen.getByLabelText("Load scope per hand"));
    expect(screen.queryByText("Style (optional)")).toBeNull();
    expect(screen.queryByLabelText("Style paused")).toBeNull();
    await fireEvent.changeText(screen.getByLabelText("Extra attention note"), "Watch my shoulder");
    await fireEvent.press(screen.getByLabelText("Submit for Analysis"));

    expect(onAnalyze).toHaveBeenCalledWith({
      exercise: { source: "custom", catalogExerciseId: null, label: "One-Arm Dumbbell Row" },
      amount: { kind: "reps", value: 8, countScope: "per_side" },
      load: { kind: "known", value: 40, unit: "lb", scope: "per_hand" },
      side: "left",
      styles: [],
      focusNote: "Watch my shoulder",
    });
  });

  it("hides side during reanalysis and does not resubmit a saved legacy style", async () => {
    const onAnalyze = jest.fn();
    const screen = await renderDeclaration(
      <SetDeclarationScreen
        localVideoUri="file:///saved-set.mp4"
        initialDeclaration={savedUnilateralDeclaration}
        showSide={false}
        analyzeLabel="Analyze Again"
        secondaryLabel="Cancel"
        onAnalyze={onAnalyze}
        onRetake={jest.fn()}
      />,
    );

    expect(screen.queryByText("Side pattern")).toBeNull();
    expect(screen.queryByText("Style (optional)")).toBeNull();

    await fireEvent.press(screen.getByLabelText("Analyze Again"));
    expect(onAnalyze).toHaveBeenCalledWith({
      ...savedUnilateralDeclaration,
      side: null,
      styles: [],
    });
  });

  it("submits typed timed bodyweight work without an extra exercise confirmation", async () => {
    const onAnalyze = jest.fn();
    const screen = await renderDeclaration(
      <SetDeclarationScreen
        localVideoUri="file:///set.mp4"
        onAnalyze={onAnalyze}
        onRetake={jest.fn()}
      />,
    );

    await fireEvent.changeText(screen.getByLabelText("Exact exercise"), "Wall handstand hold");
    await fireEvent.press(screen.getByLabelText("Measure in seconds"));
    await fireEvent.changeText(screen.getByLabelText("Completed amount"), "30");
    await fireEvent.press(screen.getByLabelText("Bodyweight load"));
    await fireEvent.press(screen.getByLabelText("Submit for Analysis"));

    expect(onAnalyze).toHaveBeenCalledWith(expect.objectContaining({
      exercise: { source: "custom", catalogExerciseId: null, label: "Wall handstand hold" },
      amount: { kind: "seconds", value: 30, countScope: null },
      load: { kind: "bodyweight" },
    }));
  });

  it("offers a prominent rerecord action without analyzing", async () => {
    const onRetake = jest.fn();
    const screen = await renderDeclaration(
      <SetDeclarationScreen
        localVideoUri="file:///set.mp4"
        onAnalyze={jest.fn()}
        onRetake={onRetake}
      />,
    );
    expect(screen.queryByLabelText("Retake")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Re-record this set"));
    expect(onRetake).toHaveBeenCalledTimes(1);
  });

  it("clears hidden count and load fields instead of submitting stale values", async () => {
    const onAnalyze = jest.fn();
    const screen = await renderDeclaration(
      <SetDeclarationScreen
        localVideoUri="file:///set.mp4"
        onAnalyze={onAnalyze}
        onRetake={jest.fn()}
      />,
    );
    await fireEvent.changeText(screen.getByLabelText("Exact exercise"), "Bench press");
    await fireEvent.changeText(screen.getByLabelText("Completed amount"), "8");
    await fireEvent.press(screen.getByLabelText("Count is total"));
    await fireEvent.press(screen.getByLabelText("Known weight"));
    await fireEvent.changeText(screen.getByLabelText("Load value"), "40");
    await fireEvent.press(screen.getByLabelText("Measure in seconds"));
    await fireEvent.press(screen.getByLabelText("Bodyweight load"));
    await fireEvent.changeText(screen.getByLabelText("Completed amount"), "30");
    await fireEvent.press(screen.getByLabelText("Submit for Analysis"));

    expect(onAnalyze).toHaveBeenCalledWith(expect.objectContaining({
      amount: { kind: "seconds", value: 30, countScope: null },
      load: { kind: "bodyweight" },
    }));
  });
});
