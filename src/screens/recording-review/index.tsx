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
  const [tab, setTab] = useState<ReviewTab>("video");
  const remaining = typeof analysisRemaining === "number" && Number.isFinite(analysisRemaining)
    ? Math.max(0, Math.floor(analysisRemaining))
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.cameraBlack }}>
      <ScrollView
        alwaysBounceVertical={false}
        bounces={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 16 }}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        testID="recording-review-scroll"
      >
        <View style={{ minHeight: 164 }}>
          <Pressable
            accessibilityLabel="Go back from Check Recording"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onRetake}
            style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, borderWidth: 1, borderColor: "#292929", backgroundColor: "#151515", opacity: pressed ? 0.75 : 1 })}
          >
            <CaptureReferenceIcon name="back" color={colors.text} size={24} />
          </Pressable>
          <View pointerEvents="none" style={{ marginTop: -37, alignItems: "center", paddingHorizontal: 38 }}>
            <Text selectable style={[typography.title, { color: colors.text, fontSize: 23, lineHeight: 29, letterSpacing: -0.65, textAlign: "center" }]}>Tell Formie <Text style={{ color: colors.gold }}>what you did</Text></Text>
            <Text selectable style={[typography.body, { marginTop: 8, color: "#D0D0D0", fontSize: 14, lineHeight: 21, textAlign: "center" }]}>You provide the set facts.{"\n"}Formie focuses on your technique{"\n"}and every visible correction.</Text>
          </View>
        </View>

        <View testID="recording-review-tabs" accessibilityRole="tablist" style={{ height: 52, flexDirection: "row", padding: 3, borderRadius: 26, borderWidth: 1, borderColor: "#2D2D2D", backgroundColor: "#171717" }}>
          <TabButton icon="play" label="Video" accessibilityLabel="Video tab" selected={tab === "video"} onPress={() => setTab("video")} />
          <TabButton icon="list" label="What to check" accessibilityLabel="What to check tab" selected={tab === "checks"} onPress={() => setTab("checks")} />
        </View>

        <View style={{ marginTop: 14 }}>
          {tab === "video" ? <View testID="recording-review-video-tab"><ReferenceVideoControls localVideoUri={localVideoUri} /></View> : <View testID="recording-review-checks-tab"><RecordingChecklist /></View>}
        </View>
      </ScrollView>

      <View testID="recording-review-footer" style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: insets.bottom + 10, borderTopWidth: 1, borderTopColor: "#202020", backgroundColor: "#0B0B0B" }}>
        <View style={{ minHeight: 72, flexDirection: "row", alignItems: "stretch", gap: 10, padding: 8, borderRadius: 16, borderWidth: 1, borderColor: "#232323", backgroundColor: "#151515" }}>
          <View accessibilityRole="summary" style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 9 }}>
            <View style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 24, borderWidth: 1, borderColor: "rgba(200,169,107,0.65)" }}><CaptureReferenceIcon name="quota" color={colors.text} size={25} /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text selectable numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[typography.label, { color: colors.gold, fontSize: 12, lineHeight: 16 }]}>1 analysis will be used</Text>
              <Text selectable numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[typography.caption, { color: colors.textSecondary, fontSize: 11, lineHeight: 15, fontVariant: ["tabular-nums"] }]}>{remaining === null ? "Balance updates after analysis" : `${remaining} available now`}</Text>
            </View>
          </View>
          <Pressable accessibilityLabel="Continue" accessibilityRole="button" onPress={onUseRecording} style={({ pressed }) => ({ minWidth: 150, flex: 0.86, minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, borderRadius: 12, backgroundColor: colors.gold, opacity: pressed ? 0.86 : 1 })}>
            <Text style={[typography.label, { color: colors.cameraBlack, fontSize: 15, lineHeight: 20 }]}>Continue</Text><Text style={{ color: colors.cameraBlack, fontSize: 24, lineHeight: 25 }}>→</Text>
          </Pressable>
        </View>
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
