/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { RecordingPreflightScreen } from "./index";

const mockPlay = jest.fn();
const mockPlayer = { loop: false, muted: false, play: mockPlay };
const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
};

function renderPreflight(screen: ReactElement) {
  return render(<SafeAreaProvider initialMetrics={safeAreaMetrics}>{screen}</SafeAreaProvider>);
}

jest.mock("expo-video", () => {
  const { View } = require("react-native");
  return {
    useVideoPlayer: (_source: string, setup?: (player: typeof mockPlayer) => void) => {
      setup?.(mockPlayer);
      return mockPlayer;
    },
    VideoView: View,
  };
});

describe("RecordingPreflightScreen", () => {
  beforeEach(() => {
    mockPlay.mockClear();
    mockPlayer.loop = false;
    mockPlayer.muted = false;
  });

  it("shows the rejected recording beside personalized camera guidance with no bypass", async () => {
    const onRetake = jest.fn();
    const onReviewSetup = jest.fn();
    const onBack = jest.fn();
    const screen = await renderPreflight(
      <RecordingPreflightScreen
        mode="rejected"
        localVideoUri="file:///recordings/rejected-set.mp4"
        reason="Your knees and feet leave the frame at the bottom of each squat."
        guidance={{
          phoneSetup: "Raise the phone near hip height and point it level at the center of the movement.",
          positioning: "Move back until the entire squat remains inside the frame.",
          visibilityTarget: "Keep your torso, hips, knees, and dumbbell visible through the full repetition.",
        }}
        onBack={onBack}
        onRetake={onRetake}
        onReviewSetup={onReviewSetup}
      />,
    );

    expect(screen.getByText("Adjust your camera and try again")).toBeTruthy();
    expect(screen.queryByText(
      "A small camera adjustment will help Formie see the movement clearly enough for reliable coaching.",
    )).toBeNull();
    expect(screen.getByLabelText("Recording that needs a camera adjustment").props.nativeControls).toBe(true);
    expect(mockPlayer.loop).toBe(true);
    expect(mockPlayer.muted).toBe(true);
    expect(mockPlay).toHaveBeenCalledTimes(1);
    expect(screen.getByText("What needs to change")).toBeTruthy();
    expect(screen.getByText("Place your phone")).toBeTruthy();
    expect(screen.getByText("Frame the movement")).toBeTruthy();
    expect(screen.getByText("Make sure we can see")).toBeTruthy();
    expect(screen.queryByText("Use recording anyway")).toBeNull();
    expect(screen.queryByText("Analyze Anyway")).toBeNull();

    await fireEvent.press(screen.getByLabelText("Back"));
    expect(onBack).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText("Retake Recording"));
    expect(onRetake).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText("Review Exercise Setup"));
    expect(onReviewSetup).toHaveBeenCalledTimes(1);
  });

  it("blocks when the check is unavailable and offers back, retry, or rerecord", async () => {
    const onRetry = jest.fn();
    const onRetake = jest.fn();
    const onBack = jest.fn();
    const screen = await renderPreflight(
      <RecordingPreflightScreen mode="unavailable" onBack={onBack} onRetry={onRetry} onRetake={onRetake} />,
    );

    expect(screen.queryByText("Use recording anyway")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Back"));
    expect(onBack).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText("Try check again"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("lets the user leave while the recording check is running", async () => {
    const onBack = jest.fn();
    const screen = await renderPreflight(<RecordingPreflightScreen mode="checking" onBack={onBack} />);

    await fireEvent.press(screen.getByLabelText("Back"));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(
      "Checking the camera view, visible movement, and whether the recording can support trustworthy advice.",
    )).toBeNull();
  });
});
