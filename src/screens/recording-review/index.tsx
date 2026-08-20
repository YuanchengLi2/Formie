import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CaptureReferenceIcon } from "@/components/capture-reference-icon";
import { HapticPressable as Pressable } from "@/components/haptic-pressable";
import { RecordingChecklist } from "@/components/recording-checklist";
import { ReferenceVideoControls } from "@/components/reference-video-controls";
import { colors } from "@/theme/colors";
import { radii } from "@/theme/spacing";
import { typography } from "@/theme/type";

type RecordingReviewScreenProps = {
  localVideoUri: string;
  analysisRemaining: number | null;
  onUseRecording: () => void;
  onRetake: () => void;
};

type ReviewTab = "video" | "checks";

export function RecordingReviewScreen({ localVideoUri, analysisRemaining, onUseRecording, onRetake }: RecordingReviewScreenProps) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<ReviewTab>("checks");
  const remaining = typeof analysisRemaining === "number" && Number.isFinite(analysisRemaining)
    ? Math.max(0, Math.floor(analysisRemaining))
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.cameraBlack }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, gap: 12 }}>
        <View style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable
            accessibilityLabel="Go back from Check Recording"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onRetake}
            style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, borderWidth: 1, borderColor: "#292929", backgroundColor: "#151515", opacity: pressed ? 0.75 : 1 })}
          >
            <CaptureReferenceIcon name="back" color={colors.text} size={24} />
          </Pressable>
          <Text selectable accessibilityRole="header" style={[typography.title, { flex: 1, color: colors.text, fontSize: 25, lineHeight: 31, letterSpacing: -0.7 }]}>Check your recording</Text>
        </View>

        <View testID="recording-review-tabs" accessibilityRole="tablist" style={{ height: 52, flexDirection: "row", padding: 3, borderRadius: 26, borderWidth: 1, borderColor: "#2D2D2D", backgroundColor: "#171717" }}>
          <TabButton icon="play" label="Video" accessibilityLabel="Video tab" selected={tab === "video"} onPress={() => setTab("video")} />
          <TabButton icon="list" label="What to check" accessibilityLabel="What to check tab" selected={tab === "checks"} onPress={() => setTab("checks")} />
        </View>
      </View>

      {tab === "video" ? (
        <View testID="recording-review-video-tab" style={{ flex: 1, minHeight: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
          <ReferenceVideoControls fillAvailableSpace localVideoUri={localVideoUri} />
        </View>
      ) : (
        <ScrollView
          alwaysBounceVertical={false}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 }}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          testID="recording-review-scroll"
        >
          <View testID="recording-review-checks-tab"><RecordingChecklist /></View>
        </ScrollView>
      )}

      <View testID="recording-review-footer" style={{ gap: 8, paddingHorizontal: 16, paddingTop: 9, paddingBottom: insets.bottom + 9, borderTopWidth: 1, borderTopColor: "#202020", backgroundColor: "#0B0B0B" }}>
        <View accessibilityRole="summary" style={{ minHeight: 22, flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 6 }}>
          <CaptureReferenceIcon name="quota" color={colors.gold} size={18} />
          <Text selectable style={[typography.label, { color: colors.gold, fontSize: 12, lineHeight: 16 }]}>1 analysis will be used</Text>
          <Text selectable style={[typography.caption, { color: colors.textSecondary, fontSize: 11, lineHeight: 15, fontVariant: ["tabular-nums"] }]}>· {remaining === null ? "Balance updates after analysis" : `${remaining} available now`}</Text>
        </View>
        <Pressable accessibilityLabel="Continue" accessibilityRole="button" onPress={onUseRecording} style={({ pressed }) => ({ width: "100%", minHeight: 54, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.gold, opacity: pressed ? 0.86 : 1 })}>
          <Text style={[typography.label, { color: colors.cameraBlack, fontSize: 16, lineHeight: 21 }]}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TabButton({ icon, label, accessibilityLabel, selected, onPress }: { icon: "play" | "list"; label: string; accessibilityLabel: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="tab" accessibilityState={{ selected }} onPress={onPress} style={{ flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: radii.pill, backgroundColor: selected ? colors.gold : "transparent" }}>
      <CaptureReferenceIcon name={icon} color={selected ? colors.cameraBlack : colors.textSecondary} size={18} />
      <Text style={[typography.label, { color: selected ? colors.cameraBlack : colors.textSecondary, fontSize: 14 }]}>{label}</Text>
    </Pressable>
  );
}
