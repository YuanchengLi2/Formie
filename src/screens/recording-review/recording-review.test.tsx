/* eslint-disable import/first */
import React, { type ReactElement } from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
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
  it("opens on the recording checklist and keeps the video as a full-height tab", async () => {
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

    expect(screen.getByText("Check your recording")).toBeTruthy();
    expect(screen.queryByText(/Tell Formie/)).toBeNull();
    expect(screen.getByLabelText("Video tab")).toBeTruthy();
    expect(screen.getByLabelText("What to check tab")).toBeTruthy();
    expect(screen.getByText("Camera isn’t too far away")).toBeTruthy();
    expect(screen.getByText("Whole movement visible")).toBeTruthy();
    expect(screen.getByText("Camera stays in the same position")).toBeTruthy();
    expect(screen.queryByLabelText("Recorded set preview")).toBeNull();
    expect(screen.getByTestId("recording-review-scroll").props.nestedScrollEnabled).toBe(true);
    expect(StyleSheet.flatten(screen.getByTestId("recording-review-scroll").props.contentContainerStyle)).toMatchObject({ paddingTop: 18 });
    expect(screen.queryByLabelText("Check 1 status")).toBeNull();

    await fireEvent.press(screen.getByLabelText("Video tab"));
    expect(screen.getByLabelText("Recorded set preview")).toBeTruthy();
    expect(screen.getByText("Drag or swipe to scrub")).toBeTruthy();
    expect(screen.getByTestId("recording-review-video-tab").props.style).toEqual(expect.objectContaining({ flex: 1 }));
    const videoFrameStyle = StyleSheet.flatten(screen.getByTestId("recording-video-frame").props.style);
    expect(videoFrameStyle).toEqual(expect.objectContaining({ flex: 1 }));
    expect(videoFrameStyle.aspectRatio).toBeUndefined();
    expect(screen.getByText("1 analysis will be used")).toBeTruthy();
    expect(screen.getByText(/10 available now/)).toBeTruthy();
    expect(screen.queryByText("FINAL CHECK")).toBeNull();
    expect(screen.queryByText("Is this recording ready?")).toBeNull();
    await fireEvent.press(screen.getByLabelText("What to check tab"));
    expect(screen.getByTestId("recording-review-checklist").props.style).toEqual(expect.objectContaining({ borderRadius: 16 }));
    expect(screen.queryByText("6 things to check")).toBeNull();
    expect(screen.queryByText(/Make sure your recording meets/)).toBeNull();
    expect(screen.getByTestId("recording-review-check-row-0").props.style).toEqual(expect.objectContaining({ width: "100%", minHeight: 78 }));
    expect(screen.getByTestId("recording-review-check-icon-0").props.style).toEqual(expect.objectContaining({ width: 40, height: 40, borderRadius: 11, backgroundColor: "#262117" }));

    await fireEvent.press(screen.getByLabelText("Go back from Check Recording"));
    expect(onRetake).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByLabelText("Continue"));
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

    expect(screen.getByText(/Balance updates after analysis/)).toBeTruthy();
    expect(screen.queryByText(/remaining this month/)).toBeNull();
  });
});
