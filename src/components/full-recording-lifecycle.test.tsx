import React from "react";
import { cleanup, render } from "@testing-library/react-native";

let mockReleased = false;

jest.mock("expo-video", () => {
  const { useEffect, useMemo } = require("react") as typeof React;
  const { View } = require("react-native") as typeof import("react-native");
  return {
    VideoView: View,
    useVideoPlayer: (_source: string, setup?: (player: Record<string, unknown>) => void) => {
    const player = useMemo(() => {
      const instance: Record<string, unknown> = {
        currentTime: 0,
        addListener: jest.fn(() => ({ remove: jest.fn() })),
        play: jest.fn(),
        pause: jest.fn(),
      };
      Object.defineProperty(instance, "timeUpdateEventInterval", {
        configurable: true,
        get: () => 0,
        set: () => {
          if (mockReleased) throw new Error("Calling the 'set' function has failed");
        },
      });
      setup?.(instance);
      return instance;
    }, [setup]);

    useEffect(() => () => {
      mockReleased = true;
    }, []);

    return player;
    },
  };
});

import { FullRecording } from "./full-recording";

describe("full recording player lifecycle", () => {
  beforeEach(() => {
    mockReleased = false;
  });

  it("does not write native player properties after Expo releases the player", () => {
    render(<FullRecording videoUrl="https://example.test/set.mp4" durationMs={10_000} />);

    expect(() => cleanup()).not.toThrow();
  });
});
