jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
jest.mock("expo-video", () => {
  const { View } = require("react-native");
  return {
    VideoView: View,
    useVideoPlayer: () => ({ currentTime: 0, pause: jest.fn() }),
  };
});

export {};
