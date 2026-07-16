import { useState } from "react";
import { Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";

import { EvidenceFocusOverlay, focusVideoStyle, zoomedFocusRegion } from "@/components/evidence-focus-overlay";
import type { EvidenceMoment } from "@/features/analysis/result-schema";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

const zoomScale = 1.7;

export function EvidenceVideo({ videoUrl, evidence }: { videoUrl: string; evidence: EvidenceMoment }) {
  const [layout, setLayout] = useState({ width: 320, height: 480 });
  const candidateFocus = evidence.focusRegion;
  const focus = candidateFocus && candidateFocus.confidence >= 0.8 ? candidateFocus : null;
  const [showMarkedFrame, setShowMarkedFrame] = useState(Boolean(focus));
  const peakMs = evidence.peakMs ?? evidence.startMs;
  const player = useVideoPlayer(videoUrl, (createdPlayer) => {
    createdPlayer.currentTime = peakMs / 1_000;
    createdPlayer.pause();
  });

  const onLayout = (event: LayoutChangeEvent) => setLayout(event.nativeEvent.layout);
  const marked = Boolean(focus && showMarkedFrame);
  const videoStyle = marked && focus
    ? focusVideoStyle(layout, focus, zoomScale)
    : { position: "absolute" as const, width: "100%" as const, height: "100%" as const, left: 0, top: 0 };

  const toggleMarkedFrame = () => {
    if (!focus) return;
    if (showMarkedFrame) {
      setShowMarkedFrame(false);
      player.currentTime = evidence.startMs / 1_000;
      player.play();
    } else {
      player.pause();
      player.currentTime = peakMs / 1_000;
      setShowMarkedFrame(true);
    }
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View onLayout={onLayout} style={{ width: "100%", aspectRatio: 9 / 16, maxHeight: 480, borderRadius: radii.md, overflow: "hidden", backgroundColor: colors.cameraBlack }}>
        <VideoView accessibilityLabel="Video evidence" contentFit="contain" fullscreenOptions={{ enable: true }} nativeControls={!showMarkedFrame} player={player} style={videoStyle} />
        {marked && focus ? <EvidenceFocusOverlay focus={zoomedFocusRegion(focus, zoomScale)} layout={layout} /> : null}
      </View>
      {focus ? (
        <Pressable accessibilityRole="button" onPress={toggleMarkedFrame} style={({ pressed }) => ({ alignSelf: "center", paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.goldSoft : colors.surfaceRaised })}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>{showMarkedFrame ? "Play evidence clip" : "Show marked frame"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
