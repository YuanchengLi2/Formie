import { useState } from "react";
import { Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";

import type { EvidenceOverlay } from "@/features/analysis/api";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

type EvidenceVideoProps = {
  videoUrl: string;
  startMs: number;
  overlay?: EvidenceOverlay | null;
};

const zoomScale = 1.7;

export function EvidenceVideo({ videoUrl, startMs, overlay = null }: EvidenceVideoProps) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [showMarkedFrame, setShowMarkedFrame] = useState(Boolean(overlay));
  const player = useVideoPlayer(videoUrl, (createdPlayer) => {
    createdPlayer.currentTime = (overlay?.timeMs ?? startMs) / 1_000;
    createdPlayer.pause();
  });

  const onLayout = (event: LayoutChangeEvent) => setLayout(event.nativeEvent.layout);
  const marked = Boolean(overlay && showMarkedFrame);
  const videoStyle = marked && overlay && layout.width > 0 && layout.height > 0
    ? {
        position: "absolute" as const,
        width: layout.width * zoomScale,
        height: layout.height * zoomScale,
        left: layout.width / 2 - overlay.centerX * layout.width * zoomScale,
        top: layout.height / 2 - overlay.centerY * layout.height * zoomScale,
      }
    : { position: "absolute" as const, width: "100%" as const, height: "100%" as const, left: 0, top: 0 };

  const toggleMarkedFrame = () => {
    if (!overlay) return;
    if (showMarkedFrame) {
      setShowMarkedFrame(false);
      player.currentTime = startMs / 1_000;
      player.play();
    } else {
      player.pause();
      player.currentTime = overlay.timeMs / 1_000;
      setShowMarkedFrame(true);
    }
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View onLayout={onLayout} style={{ width: "100%", aspectRatio: 9 / 16, maxHeight: 480, borderRadius: radii.md, overflow: "hidden", backgroundColor: colors.cameraBlack }}>
        <VideoView
          accessibilityLabel="Video evidence"
          contentFit="contain"
          fullscreenOptions={{ enable: true }}
          nativeControls={!showMarkedFrame}
          player={player}
          style={videoStyle}
        />
        {marked && overlay ? (
          <View
            accessibilityLabel={`Tracked evidence focus at ${overlay.trackedAreas.join(", ")}`}
            pointerEvents="none"
            style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}
          >
            <View style={{ width: Math.max(70, overlay.radius * layout.width * zoomScale * 2), aspectRatio: 1, borderRadius: radii.pill, borderWidth: 3, borderColor: colors.gold, backgroundColor: "rgba(200,169,107,0.08)" }} />
            <Text selectable style={[typography.caption, { marginTop: spacing.sm, color: colors.gold, letterSpacing: 1.2 }]}>LOOK HERE</Text>
          </View>
        ) : null}
      </View>
      {overlay ? (
        <Pressable accessibilityRole="button" onPress={toggleMarkedFrame} style={({ pressed }) => ({ alignSelf: "center", paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.goldSoft : colors.surfaceRaised })}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>{showMarkedFrame ? "Play evidence clip" : "Show marked frame"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
