import { VideoView, useVideoPlayer } from "expo-video";
import type { StyleProp, ViewStyle } from "react-native";

const motionSources = {
  cameraSetup: require("../../assets/motion/camera-setup-loop.mp4"),
} as const;

type ProductionMotionProps = {
  kind: keyof typeof motionSources;
  accessibilityLabel: string;
  playbackRate?: number;
  style?: StyleProp<ViewStyle>;
};

export function ProductionMotion({ kind, accessibilityLabel, playbackRate = 1, style }: ProductionMotionProps) {
  const player = useVideoPlayer(motionSources[kind], (createdPlayer) => {
    createdPlayer.loop = true;
    createdPlayer.muted = true;
    createdPlayer.playbackRate = playbackRate;
    createdPlayer.play();
  });

  return (
    <VideoView
      accessibilityLabel={accessibilityLabel}
      contentFit="contain"
      nativeControls={false}
      player={player}
      style={style}
    />
  );
}
