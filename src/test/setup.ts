/* eslint-disable @typescript-eslint/no-require-imports -- Jest mock factories must load modules lazily. */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
jest.mock("expo-video", () => {
  const { View } = require("react-native");
  return {
    VideoView: View,
    useVideoPlayer: () => ({ currentTime: 0, duration: 12, playing: false, timeUpdateEventInterval: 0, addListener: jest.fn(() => ({ remove: jest.fn() })), play: jest.fn(), pause: jest.fn() }),
  };
});

export {};
