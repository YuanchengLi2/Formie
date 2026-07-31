import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { formatPlaybackTime, nextFrameIndex, reviewPurposeLabel } from "@/components/full-recording";
import type { ReviewFrame, ReviewFrameGroups, ReviewPurpose } from "@/features/analysis/review-frames";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

const PURPOSES: ReviewPurpose[] = ["observed", "why", "next"];

export function CoachingReviewCarousel({ groups, onSelectFrame }: { groups: ReviewFrameGroups; onSelectFrame: (frame: ReviewFrame) => void }) {
  const available = useMemo(() => PURPOSES.filter((item) => groups[item].length > 0), [groups]);
  const [purpose, setPurpose] = useState<ReviewPurpose>(available[0] ?? "observed");
  const [indices, setIndices] = useState<Record<ReviewPurpose, number>>({ observed: 0, why: 0, next: 0 });
  const frames = groups[purpose];
  const index = Math.min(indices[purpose], Math.max(0, frames.length - 1));
  const selected = frames[index] ?? null;

  const choosePurpose = (nextPurpose: ReviewPurpose) => {
    setPurpose(nextPurpose);
    const remembered = groups[nextPurpose][indices[nextPurpose]] ?? groups[nextPurpose][0];
    if (remembered) onSelectFrame(remembered);
  };
  const move = (direction: -1 | 1) => {
    const nextIndex = nextFrameIndex(index, frames.length, direction);
    setIndices((current) => ({ ...current, [purpose]: nextIndex }));
    if (frames[nextIndex]) onSelectFrame(frames[nextIndex]);
  };
  const chooseFrame = (frame: ReviewFrame, frameIndex: number) => {
    setIndices((current) => ({ ...current, [purpose]: frameIndex }));
    onSelectFrame(frame);
  };

  if (!selected) return null;

  return (
    <View style={{ gap: spacing.md }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {available.map((item) => {
          const active = item === purpose;
          return (
            <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => choosePurpose(item)} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radii.pill, borderWidth: 1, borderColor: active ? colors.gold : colors.border, backgroundColor: active ? colors.goldSoft : colors.surface }}>
              <Text style={[typography.label, { color: active ? colors.gold : colors.textSecondary }]}>{reviewPurposeLabel(item)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <Pressable accessibilityLabel="Previous review frame" accessibilityRole="button" onPress={() => move(-1)} style={{ minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 24, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.gold, fontSize: 24 }}>‹</Text></Pressable>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text selectable style={[typography.heading, { color: colors.text }]}>{selected.title}</Text>
          {selected.body ? <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{selected.body}</Text> : null}
          <Text selectable style={[typography.caption, { color: colors.gold }]}>{formatPlaybackTime(selected.timeMs)}</Text>
        </View>
        <Pressable accessibilityLabel="Next review frame" accessibilityRole="button" onPress={() => move(1)} style={{ minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 24, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.gold, fontSize: 24 }}>›</Text></Pressable>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm }}>
        <Text selectable style={[typography.caption, { marginRight: spacing.xs, color: colors.textMuted, fontVariant: ["tabular-nums"] }]}>{index + 1} of {frames.length}</Text>
        {frames.map((frame, frameIndex) => (
          <Pressable key={frame.id} accessibilityLabel={`Select review frame ${frameIndex + 1}`} onPress={() => chooseFrame(frame, frameIndex)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: frameIndex === index ? 12 : 8, height: frameIndex === index ? 12 : 8, borderRadius: 6, backgroundColor: frameIndex === index ? colors.gold : colors.textMuted }} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
