/* eslint-disable @typescript-eslint/no-require-imports -- Jest mock factories must load modules lazily. */
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
jest.mock("expo-video", () => {
  const { View } = require("react-native");
  return {
    VideoView: View,
    useVideoPlayer: () => ({ currentTime: 0, duration: 12, playing: false, play: jest.fn(), pause: jest.fn() }),
  };
});

export {};
