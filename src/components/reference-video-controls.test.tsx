/* eslint-disable import/first */
import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";

const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockEnterFullscreen = jest.fn();
const mockListeners: Record<string, (event: Record<string, unknown>) => void> = {};
let mockCurrentTime = 0;

jest.mock("expo-video", () => {
  const ReactRuntime = jest.requireActual<typeof React>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    VideoView: ReactRuntime.forwardRef((props: Record<string, unknown>, ref) => {
      ReactRuntime.useImperativeHandle(ref, () => ({ enterFullscreen: mockEnterFullscreen }));
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
    mockEnterFullscreen.mockClear();
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

  it("drives real playback state, clamped seeking, and fullscreen from the reference controls", async () => {
    const screen = await render(<ReferenceVideoControls localVideoUri="file:///set.mp4" />);

    expect(screen.getByLabelText("Recorded set preview").props.nativeControls).toBe(false);
    await fireEvent.press(screen.getByLabelText("Play recording"));
    expect(mockPlay).toHaveBeenCalledTimes(1);

    await act(async () => mockListeners.playingChange?.({ isPlaying: true }));
    await fireEvent.press(screen.getByLabelText("Pause recording"));
    expect(mockPause).toHaveBeenCalledTimes(1);

    await act(async () => mockListeners.timeUpdate?.({ currentTime: 7.8 }));
    expect(screen.getByText("0:07")).toBeTruthy();

    const timeline = screen.getByLabelText("Recording timeline");
    await fireEvent(timeline, "layout", { nativeEvent: { layout: { width: 200 } } });
    await fireEvent.press(timeline, { nativeEvent: { locationX: 250 } });
    expect(mockCurrentTime).toBe(18);

    await fireEvent.press(screen.getByLabelText("View recording fullscreen"));
    expect(mockEnterFullscreen).toHaveBeenCalledTimes(1);
  });
});
