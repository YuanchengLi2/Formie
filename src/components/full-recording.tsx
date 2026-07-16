import { Pressable, Text, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";

import type { RepTimelineItem } from "@/features/analysis/result-schema";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

export function timelineMarkerPercent(peakMs: number, durationMs: number): number {
  return Math.min(98, Math.max(2, (peakMs / Math.max(1, durationMs)) * 100));
}

export function FullRecording({ videoUrl, reps, durationMs }: { videoUrl: string; reps: RepTimelineItem[]; durationMs: number }) {
  const player = useVideoPlayer(videoUrl);

  return (
    <View style={{ overflow: "hidden", borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      <VideoView accessibilityLabel="Full exercise recording" contentFit="contain" fullscreenOptions={{ enable: true }} nativeControls player={player} style={{ width: "100%", aspectRatio: 16 / 10, maxHeight: 300, backgroundColor: colors.cameraBlack }} />
      {reps.length > 0 ? (
        <View style={{ gap: spacing.sm, padding: spacing.md }}>
          <View style={{ height: 3, borderRadius: 2, backgroundColor: colors.border }}>
            {reps.map((rep) => (
              <Pressable
                accessibilityLabel={`Jump to rep ${rep.repNumber}: ${rep.note}`}
                accessibilityRole="button"
                key={`${rep.repNumber}-${rep.peakMs}`}
                onPress={() => {
                  player.currentTime = rep.peakMs / 1_000;
                  player.pause();
                }}
                style={{ position: "absolute", left: `${timelineMarkerPercent(rep.peakMs, durationMs)}%`, top: -7, width: 17, height: 17, marginLeft: -8, borderRadius: 9, borderWidth: 2, borderColor: colors.background, backgroundColor: rep.assessment === "breakdown" ? colors.gold : colors.textSecondary }}
              />
            ))}
          </View>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>Tap a marker to inspect that repetition</Text>
        </View>
      ) : null}
    </View>
  );
}
