/* eslint-disable import/first */
import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockListeners: Record<string, (event: Record<string, unknown>) => void> = {};
let mockCurrentTime = 0;

jest.mock("expo-video", () => {
  const ReactRuntime = jest.requireActual<typeof React>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    VideoView: ReactRuntime.forwardRef((props: Record<string, unknown>, ref) => {
      ReactRuntime.useImperativeHandle(ref, () => ({}));
      return <View {...props} />;
    }),
    useVideoPlayer: (_source: string, setup?: (player: Record<string, unknown>) => void) => {
      const playerRef = ReactRuntime.useRef<Record<string, unknown> | null>(null);
      if (!playerRef.current) {
        const player: Record<string, unknown> = {
          addListener: jest.fn((eventName: string, callback: (event: Record<string, unknown>) => void) => {
            mockListeners[eventName] = callback;
            return { remove: jest.fn(() => { delete mockListeners[eventName]; }) };
          }),
          duration: 18,
          pause: mockPause,
          play: mockPlay,
          playing: false,
          status: "readyToPlay",
        };
        Object.defineProperty(player, "currentTime", {
          configurable: true,
          get: () => mockCurrentTime,
          set: (value) => { mockCurrentTime = Number(value); },
        });
        Object.defineProperty(player, "timeUpdateEventInterval", {
          configurable: true,
          get: () => 0,
          set: jest.fn(),
        });
        setup?.(player);
        playerRef.current = player;
      }
      return playerRef.current;
    },
  };
});

import { formatPlaybackTime, ReferenceVideoControls } from "./reference-video-controls";

describe("ReferenceVideoControls", () => {
  beforeEach(() => {
    mockPlay.mockClear();
    mockPause.mockClear();
    mockCurrentTime = 0;
    Object.keys(mockListeners).forEach((key) => delete mockListeners[key]);
  });

  it.each([
    [0, "0:00"],
    [18.9, "0:18"],
    [65, "1:05"],
    [Number.NaN, "0:00"],
    [-4, "0:00"],
  ])("formats %s seconds as %s", (seconds, expected) => {
    expect(formatPlaybackTime(seconds)).toBe(expected);
  });

  it("drives real playback state, clamped seeking, and an explicitly dismissible fullscreen view", async () => {
    const screen = await render(<ReferenceVideoControls localVideoUri="file:///set.mp4" />);

    expect(screen.getByLabelText("Recorded set preview").props.nativeControls).toBe(false);
    await fireEvent.press(screen.getByLabelText("Play recording"));
    expect(mockPlay).toHaveBeenCalledTimes(1);

    await act(async () => mockListeners.playingChange?.({ isPlaying: true }));
    await fireEvent.press(screen.getByLabelText("Pause recording"));
    expect(mockPause).toHaveBeenCalledTimes(1);

    await act(async () => mockListeners.timeUpdate?.({ currentTime: 7.8 }));
    expect(screen.getByText("0:07")).toBeTruthy();
    expect(screen.getByText(" / 0:18")).toBeTruthy();
    expect(screen.getByText("Drag or swipe to scrub")).toBeTruthy();

    const timeline = screen.getByLabelText("Recording timeline");
    await fireEvent(timeline, "layout", { nativeEvent: { layout: { width: 200 } } });
    await fireEvent.press(timeline, { nativeEvent: { locationX: 250 } });
    expect(mockCurrentTime).toBe(18);
    await fireEvent(timeline, "responderMove", { nativeEvent: { locationX: 50 } });
    expect(mockCurrentTime).toBe(4.5);

    await fireEvent.press(screen.getByLabelText("View recording fullscreen"));
    expect(screen.getByLabelText("Fullscreen recording preview")).toBeTruthy();
    const close = screen.getByLabelText("Close fullscreen recording");
    expect(StyleSheet.flatten(close.props.style)).toMatchObject({ minWidth: 96, minHeight: 52, backgroundColor: "#C8A96B" });
    expect(screen.getByText("Close")).toBeTruthy();
    await fireEvent.press(close);
    expect(screen.queryByLabelText("Fullscreen recording preview")).toBeNull();
  });

  it("can fill the review tab instead of forcing a short landscape card", async () => {
    const screen = await render(<ReferenceVideoControls fillAvailableSpace localVideoUri="file:///set.mp4" />);
    const frameStyle = StyleSheet.flatten(screen.getByTestId("recording-video-frame").props.style);

    expect(frameStyle).toMatchObject({ flex: 1, minHeight: 0 });
    expect(frameStyle.aspectRatio).toBeUndefined();
  });
});
