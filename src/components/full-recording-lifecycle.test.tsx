import React from "react";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react-native";

import type { ReviewFrame } from "@/features/analysis/review-frames";

import { FullRecording } from "./full-recording";

let mockReleased = false;
let mockCurrentTime = 0;
const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockListeners: Record<string, (event: Record<string, unknown>) => void> = {};
const mockGestureCallbacks: Record<string, (event: Record<string, number>) => void> = {};
const mockGestureConfig: Record<string, unknown> = {};

jest.mock("react-native-gesture-handler", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  const pan: Record<string, jest.Mock> = {
    activeOffsetX: jest.fn((value) => { mockGestureConfig.activeOffsetX = value; return pan; }),
    failOffsetY: jest.fn((value) => { mockGestureConfig.failOffsetY = value; return pan; }),
    onStart: jest.fn((callback) => { mockGestureCallbacks.onStart = callback; return pan; }),
    onUpdate: jest.fn((callback) => { mockGestureCallbacks.onUpdate = callback; return pan; }),
    onEnd: jest.fn((callback) => { mockGestureCallbacks.onEnd = callback; return pan; }),
    onFinalize: jest.fn((callback) => { mockGestureCallbacks.onFinalize = callback; return pan; }),
    runOnJS: jest.fn(() => pan),
  };
  return { Gesture: { Pan: () => pan }, GestureDetector: View };
});

jest.mock("expo-video", () => {
  const { useEffect, useRef } = jest.requireActual<typeof React>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    VideoView: View,
    useVideoPlayer: (_source: string, setup?: (player: Record<string, unknown>) => void) => {
      const playerRef = useRef<Record<string, unknown> | null>(null);
      if (!playerRef.current) {
        const instance: Record<string, unknown> = {
          addListener: jest.fn((eventName: string, callback: (event: Record<string, unknown>) => void) => {
            mockListeners[eventName] = callback;
            return { remove: jest.fn(() => { delete mockListeners[eventName]; }) };
          }),
          play: mockPlay,
          pause: mockPause,
          status: "loading",
        };
        Object.defineProperty(instance, "currentTime", {
          configurable: true,
          get: () => mockCurrentTime,
          set: (value) => { mockCurrentTime = Number(value); },
        });
        Object.defineProperty(instance, "timeUpdateEventInterval", {
          configurable: true,
          get: () => 0,
          set: () => {
            if (mockReleased) throw new Error("Calling the 'set' function has failed");
          },
        });
        setup?.(instance);
        playerRef.current = instance;
      }
      const player = playerRef.current;

      useEffect(() => () => {
        mockReleased = true;
      }, []);

      return player;
    },
  };
});

describe("full recording player lifecycle", () => {
  beforeEach(() => {
    mockReleased = false;
    mockCurrentTime = 0;
    mockPlay.mockClear();
    mockPause.mockClear();
    Object.keys(mockListeners).forEach((key) => delete mockListeners[key]);
    Object.keys(mockGestureCallbacks).forEach((key) => delete mockGestureCallbacks[key]);
    Object.keys(mockGestureConfig).forEach((key) => delete mockGestureConfig[key]);
  });

  it("does not write native player properties after Expo releases the player", async () => {
    await render(<FullRecording videoUrl="https://example.test/set.mp4" durationMs={10_000} />);

    expect(() => cleanup()).not.toThrow();
  });

  it("uses only the in-video control for play and pause", async () => {
    const screen = await render(<FullRecording videoUrl="https://example.test/set.mp4" durationMs={10_000} />);

    const playButton = screen.getByLabelText("Play recording in video");
    expect(playButton).toHaveStyle({ position: "absolute", top: "50%", left: "50%" });
    await fireEvent.press(playButton);
    expect(mockPlay).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Play recording")).toBeNull();

    await act(async () => mockListeners.playingChange?.({ isPlaying: true }));

    expect(screen.queryByLabelText("Play recording in video")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Pause recording in video"));
    expect(mockPause).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Pause recording")).toBeNull();
  });

  it("supports tap seeking and horizontal drag seeking without claiming vertical gestures", async () => {
    const screen = await render(<FullRecording videoUrl="https://example.test/set.mp4" durationMs={10_000} />);
    const timeline = screen.getByLabelText("Recording timeline");
    await fireEvent(timeline, "layout", { nativeEvent: { layout: { width: 200 } } });

    await fireEvent.press(timeline, { nativeEvent: { locationX: 50 } });
    expect(mockCurrentTime).toBe(2.5);

    await act(async () => mockGestureCallbacks.onStart?.({ absoluteX: 20 }));
    await act(async () => mockGestureCallbacks.onUpdate?.({ absoluteX: 100 }));
    expect(screen.getByText("00:05")).toBeTruthy();
    await act(async () => mockGestureCallbacks.onEnd?.({ absoluteX: 150 }));
    expect(mockCurrentTime).toBe(7.5);
    expect(mockGestureConfig.activeOffsetX).toEqual([-6, 6]);
    expect(mockGestureConfig.failOffsetY).toEqual([-8, 8]);
  });

  it("shows exercise-relative time while seeking the original video coordinates", async () => {
    const screen = await render(
      <FullRecording
        videoUrl="https://example.test/set.mp4"
        durationMs={10_000}
        playbackWindow={{ sourceStartMs: 2_000, sourceEndMs: 8_000 }}
      />,
    );
    await act(async () => mockListeners.statusChange?.({ status: "readyToPlay" }));
    expect(mockCurrentTime).toBe(2);
    expect(screen.getByText("00:00")).toBeTruthy();
    expect(screen.getByText("00:06")).toBeTruthy();

    const timeline = screen.getByLabelText("Recording timeline");
    await fireEvent(timeline, "layout", { nativeEvent: { layout: { width: 200 } } });
    await fireEvent.press(timeline, { nativeEvent: { locationX: 100 } });

    expect(mockCurrentTime).toBe(5);
    expect(screen.getByText("00:03")).toBeTruthy();
  });

  it("pauses at the exercise end and restarts from its first frame", async () => {
    const screen = await render(
      <FullRecording
        videoUrl="https://example.test/set.mp4"
        durationMs={10_000}
        playbackWindow={{ sourceStartMs: 2_000, sourceEndMs: 8_000 }}
      />,
    );
    await act(async () => mockListeners.statusChange?.({ status: "readyToPlay" }));
    await act(async () => mockListeners.timeUpdate?.({ currentTime: 8.1 }));

    expect(mockPause).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("00:06")).toHaveLength(2);

    await fireEvent.press(screen.getByLabelText("Play recording in video"));
    expect(mockCurrentTime).toBe(2);
    expect(mockPlay).toHaveBeenCalledTimes(1);
  });

  it("shows loading and playback errors from the native player status", async () => {
    const screen = await render(<FullRecording videoUrl="https://example.test/set.mp4" durationMs={10_000} />);
    expect(screen.getByText("Loading video…")).toBeTruthy();

    await act(async () => mockListeners.statusChange?.({ status: "error", error: { message: "The video could not be loaded." } }));

    expect(screen.getByRole("alert")).toHaveTextContent("The video could not be loaded.");
  });

  it("seeks and pauses when the coach requests a reviewed timestamp", async () => {
    await render(<FullRecording videoUrl="https://example.test/set.mp4" durationMs={10_000} seekToMs={3_500} />);
    await waitFor(() => expect(mockCurrentTime).toBe(3.5));
    expect(mockPause).toHaveBeenCalled();
  });

  it("repeats the same seek when a new coach seek request is issued", async () => {
    const view = await render(<FullRecording videoUrl="https://example.test/set.mp4" durationMs={10_000} seekToMs={3_500} seekRequestId={1} />);
    await waitFor(() => expect(mockPause).toHaveBeenCalledTimes(1));
    mockCurrentTime = 8;

    await view.rerender(<FullRecording videoUrl="https://example.test/set.mp4" durationMs={10_000} seekToMs={3_500} seekRequestId={2} />);

    await waitFor(() => expect(mockCurrentTime).toBe(3.5));
    expect(mockPause).toHaveBeenCalledTimes(2);
  });

  it("seeks to the initial selected evidence after the player is ready and stays paused", async () => {
    const frame: ReviewFrame = {
      id: "observed-shoulder-0-3500",
      purpose: "observed",
      title: "Shoulder rises",
      body: "The right shoulder rises before the left.",
      findingId: "shoulder",
      finding: {
        id: "shoulder",
        coachingArea: "form",
        title: "Shoulder rises",
        detail: "The right shoulder rises before the left.",
        whyItMatters: "The pull becomes uneven.",
        correction: "Keep both shoulders level.",
        cue: "Level shoulders.",
        severity: "important",
        evidence: [],
      },
      evidence: {
        startMs: 3_000,
        peakMs: 3_500,
        endMs: 4_000,
        repNumber: 2,
        phase: "concentric",
        visualEvidence: "The right shoulder rises before the left.",
        visibleBodyAreas: ["shoulders"],
        confidence: 0.9,
      },
      timeMs: 3_500,
    };
    const view = await render(
      <FullRecording videoUrl="https://example.test/set.mp4" durationMs={10_000} playbackWindow={{ sourceStartMs: 2_000, sourceEndMs: 8_000 }} reviewFrames={[frame]} selectedReviewFrame={frame} />,
    );
    await act(async () => mockListeners.statusChange?.({ status: "readyToPlay" }));
    await waitFor(() => expect(mockCurrentTime).toBe(3.5));
    expect(mockPause).toHaveBeenCalledTimes(1);

    await view.rerender(
      <FullRecording videoUrl="https://example.test/set.mp4" durationMs={10_000} playbackWindow={{ sourceStartMs: 2_000, sourceEndMs: 8_000 }} reviewFrames={[{ ...frame }]} selectedReviewFrame={{ ...frame }} />,
    );
    await fireEvent.press(view.getByLabelText("Play recording in video"));

    expect(mockPause).toHaveBeenCalledTimes(1);
    expect(mockPlay).toHaveBeenCalledTimes(1);
  });

  it("seeks to a timeline marker and stays paused on that evidence frame", async () => {
    const frame: ReviewFrame = {
      id: "observed-torso-0-6500",
      purpose: "observed",
      title: "Torso rotates",
      body: "The working shoulder turns upward during the pull.",
      findingId: "torso",
      finding: {
        id: "torso",
        coachingArea: "form",
        title: "Keep the torso steady",
        detail: "The torso rotates during the pull.",
        whyItMatters: "The pulling path changes from rep to rep.",
        correction: "Keep the shoulders facing the bench.",
        cue: "Square shoulders.",
        severity: "important",
        evidence: [],
      },
      evidence: {
        startMs: 6_000,
        peakMs: 6_500,
        endMs: 7_000,
        repNumber: 3,
        phase: "concentric",
        visualEvidence: "The working shoulder turns upward during the pull.",
        visibleBodyAreas: ["torso", "shoulders"],
        confidence: 0.92,
      },
      timeMs: 6_500,
    };
    const onSelectReviewFrame = jest.fn();
    const screen = await render(
      <FullRecording
        videoUrl="https://example.test/set.mp4"
        durationMs={10_000}
        reviewFrames={[frame]}
        onSelectReviewFrame={onSelectReviewFrame}
      />,
    );

    await fireEvent.press(screen.getByTestId(`timeline-evidence-marker-${frame.id}`));

    expect(mockCurrentTime).toBe(6.5);
    expect(mockPause).toHaveBeenCalledTimes(1);
    expect(mockPlay).not.toHaveBeenCalled();
    expect(onSelectReviewFrame).toHaveBeenCalledWith(frame);
  });
});
