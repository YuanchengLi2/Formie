/* eslint-disable import/first */
import React, { type ReactElement } from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

jest.mock("expo-video", () => {
  const ReactRuntime = jest.requireActual<typeof React>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    VideoView: ReactRuntime.forwardRef((props: Record<string, unknown>, ref) => {
      ReactRuntime.useImperativeHandle(ref, () => ({ enterFullscreen: jest.fn() }));
      return <View {...props} />;
    }),
    useVideoPlayer: (_source: string, setup?: (player: Record<string, unknown>) => void) => {
      const playerRef = ReactRuntime.useRef<Record<string, unknown> | null>(null);
      if (!playerRef.current) {
        const player = {
          addListener: jest.fn(() => ({ remove: jest.fn() })),
          currentTime: 0,
          duration: 18,
          loop: false,
          pause: jest.fn(),
          play: jest.fn(),
          playing: false,
          status: "readyToPlay",
          timeUpdateEventInterval: 0,
        };
        setup?.(player);
        playerRef.current = player;
      }
      return playerRef.current;
    },
  };
});

import { RecordingReviewScreen } from "./index";

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
};

function renderReview(element: ReactElement) {
  return render(<SafeAreaProvider initialMetrics={safeAreaMetrics}>{element}</SafeAreaProvider>);
}

describe("RecordingReviewScreen", () => {
  it("shows the exact reference hierarchy with a real projected remaining balance", async () => {
    const onRetake = jest.fn();
    const onUseRecording = jest.fn();
    const screen = await renderReview(
      <RecordingReviewScreen
        analysisRemaining={10}
        localVideoUri="file:///set.mp4"
        onRetake={onRetake}
        onUseRecording={onUseRecording}
      />,
    );

    expect(screen.getByText("Review Recording")).toBeTruthy();
    expect(screen.getByLabelText("Recorded set preview")).toBeTruthy();
    expect(screen.getByText("Before you continue")).toBeTruthy();
    expect(screen.getByText("A clear angle gives you a more accurate analysis.")).toBeTruthy();
    expect(screen.getByText("Full body visible")).toBeTruthy();
    expect(screen.getByText("Side angle")).toBeTruthy();
    expect(screen.getByText("Phone level")).toBeTruthy();
    expect(screen.getByText("Good lighting")).toBeTruthy();
    expect(screen.getByText("1 analysis will be used")).toBeTruthy();
    expect(screen.getByText("10 available now · charged only after completion")).toBeTruthy();
    expect(screen.getByTestId("recording-review-scroll").props.nestedScrollEnabled).toBe(true);
    expect(screen.queryByText("FINAL CHECK")).toBeNull();
    expect(screen.queryByText("Is this recording ready?")).toBeNull();
    expect(screen.getByTestId("recording-review-checklist").props.style).toEqual(expect.objectContaining({ borderRadius: 16 }));
    expect(screen.getByTestId("recording-review-actions").props.style).toEqual(expect.objectContaining({ flexDirection: "row" }));

    await fireEvent.press(screen.getByLabelText("Go back from Review Recording"));
    await fireEvent.press(screen.getByLabelText("Record Again"));
    expect(onRetake).toHaveBeenCalledTimes(2);

    await fireEvent.press(screen.getByLabelText("Use Recording"));
    expect(onUseRecording).toHaveBeenCalledTimes(1);
  });

  it("never invents a numeric balance when access is unresolved", async () => {
    const screen = await renderReview(
      <RecordingReviewScreen
        analysisRemaining={null}
        localVideoUri="file:///set.mp4"
        onRetake={jest.fn()}
        onUseRecording={jest.fn()}
      />,
    );

    expect(screen.getByText("Balance updates after a completed analysis")).toBeTruthy();
    expect(screen.queryByText(/remaining this month/)).toBeNull();
  });
});
