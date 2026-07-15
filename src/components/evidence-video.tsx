import { VideoView, useVideoPlayer } from "expo-video";

import { radii } from "@/theme/spacing";

type EvidenceVideoProps = {
  videoUrl: string;
  startMs: number;
};

export function EvidenceVideo({ videoUrl, startMs }: EvidenceVideoProps) {
  const player = useVideoPlayer(videoUrl, (createdPlayer) => {
    createdPlayer.currentTime = startMs / 1_000;
    createdPlayer.pause();
  });

  return (
    <VideoView
      accessibilityLabel="Video evidence"
      contentFit="contain"
      fullscreenOptions={{ enable: true }}
      nativeControls
      player={player}
      style={{ width: "100%", aspectRatio: 9 / 16, maxHeight: 480, borderRadius: radii.md, overflow: "hidden" }}
    />
  );
}
