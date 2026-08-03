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

  it("shows advisory camera guidance with an explicit continue action", async () => {
    const onRetake = jest.fn();
    const onContinue = jest.fn();
    const onBack = jest.fn();
    const screen = await renderPreflight(
      <RecordingPreflightScreen
        mode="advisory"
        localVideoUri="file:///recordings/set.mp4"
        reason="Your knees and feet are partly hidden at the bottom of each squat."
        guidance={{
          phoneSetup: "Raise the phone near hip height and point it level at the center of the movement.",
          positioning: "Move back until the entire squat remains inside the frame.",
          visibilityTarget: "Keep your torso, hips, knees, and dumbbell visible through the full repetition.",
        }}
        onBack={onBack}
        onRetake={onRetake}
        onContinue={onContinue}
      />,
    );

    expect(screen.getByText("A few recording tips")).toBeTruthy();
    expect(screen.getByText("These suggestions improve visual evidence, but they never block analysis.")).toBeTruthy();
    expect(screen.getByLabelText("Recording tips preview").props.nativeControls).toBe(true);
    expect(mockPlayer.loop).toBe(true);
    expect(mockPlayer.muted).toBe(true);
    expect(mockPlay).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Place your phone")).toBeTruthy();
    expect(screen.getByText("Frame the movement")).toBeTruthy();
    expect(screen.getByText("Keep visible")).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("Back"));
    expect(onBack).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText("Record another set"));
    expect(onRetake).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText("Continue with recording"));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("keeps advisory guidance non-blocking", async () => {
    const onContinue = jest.fn();
    const onBack = jest.fn();
    const screen = await renderPreflight(
      <RecordingPreflightScreen mode="advisory" localVideoUri="file:///recordings/set.mp4" guidance={{ phoneSetup: "Keep the phone level.", positioning: "Keep the movement in frame.", visibilityTarget: "Keep the moving joints visible." }} onBack={onBack} onContinue={onContinue} />,
    );

    await fireEvent.press(screen.getByLabelText("Back"));
    expect(onBack).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText("Continue with recording"));
    expect(onContinue).toHaveBeenCalledTimes(1);
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
