import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CaptureReferenceIcon, type CaptureReferenceIconName } from "@/components/capture-reference-icon";
import { CaptureScreenHeader } from "@/components/capture-screen-header";
import { FormButton } from "@/components/form-button";
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

const reviewChecks: readonly { label: string; icon: CaptureReferenceIconName }[] = [
  { label: "Full body visible", icon: "fullBody" },
  { label: "Side angle", icon: "sideAngle" },
  { label: "Phone level", icon: "phone" },
  { label: "Good lighting", icon: "lighting" },
];

export function RecordingReviewScreen({
  localVideoUri,
  analysisRemaining,
  onUseRecording,
  onRetake,
}: RecordingReviewScreenProps) {
  const insets = useSafeAreaInsets();
  const currentRemaining = typeof analysisRemaining === "number" && Number.isFinite(analysisRemaining)
    ? Math.max(0, Math.floor(analysisRemaining))
    : null;

  return (
    <ScrollView
      alwaysBounceVertical={false}
      bounces={false}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 28 }}
      nestedScrollEnabled
      showsVerticalScrollIndicator
      style={{ flex: 1, backgroundColor: colors.cameraBlack }}
      testID="recording-review-scroll"
    >
      <CaptureScreenHeader title="Review Recording" onBack={onRetake} />
      <View style={{ gap: 16, paddingHorizontal: 20 }}>
        <ReferenceVideoControls localVideoUri={localVideoUri} />

        <View style={{ gap: 3, paddingHorizontal: 12 }}>
          <Text accessibilityRole="header" selectable style={[typography.heading, { color: colors.text, fontSize: 21, lineHeight: 27, letterSpacing: -0.45 }]}>Before you continue</Text>
          <Text selectable style={[typography.body, { color: colors.text, fontSize: 14, lineHeight: 20 }]}>A clear angle gives you a more accurate analysis.</Text>
        </View>

        <View
          testID="recording-review-checklist"
          style={{
            overflow: "hidden",
            flexDirection: "row",
            flexWrap: "wrap",
            borderRadius: 16,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: "#3A3A3A",
            backgroundColor: colors.surface,
          }}
        >
          {reviewChecks.map((check, index) => (
            <View
              key={check.label}
              style={{
                width: "50%",
                minHeight: 104,
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                paddingHorizontal: 8,
                paddingVertical: 12,
                borderRightWidth: index % 2 === 0 ? 1 : 0,
                borderRightColor: "#3A3A3A",
                borderBottomWidth: index < 2 ? 1 : 0,
                borderBottomColor: "#3A3A3A",
              }}
            >
              <View style={{ width: 58, height: 50, alignItems: "center", justifyContent: "center" }}>
                <CaptureReferenceIcon name={check.icon} size={48} />
                <View style={{ position: "absolute", top: -2, right: -3, width: 23, height: 23, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.gold }}>
                  <CaptureReferenceIcon name="check" color={colors.cameraBlack} size={15} />
                </View>
              </View>
              <Text selectable style={[typography.body, { color: colors.text, fontSize: 14, lineHeight: 18, textAlign: "center" }]}>{check.label}</Text>
            </View>
          ))}
        </View>

        <View
          accessibilityRole="summary"
          style={{ minHeight: 74, flexDirection: "row", alignItems: "center", gap: 15, paddingHorizontal: 20, paddingVertical: 13, borderRadius: radii.lg, borderCurve: "continuous", borderWidth: 1, borderColor: colors.gold, backgroundColor: "rgba(200,169,107,0.10)" }}
        >
          <CaptureReferenceIcon name="quota" size={36} />
          <View style={{ flex: 1, gap: 1 }}>
            <Text selectable style={[typography.heading, { color: colors.text, fontSize: 16, lineHeight: 21 }]}>1 analysis will be used</Text>
            <Text selectable style={[typography.body, { color: colors.textSecondary, fontSize: 13, lineHeight: 18, fontVariant: ["tabular-nums"] }]}>
              {currentRemaining === null ? "Balance updates after a completed analysis" : `${currentRemaining} available now · charged only after completion`}
            </Text>
          </View>
        </View>

        <View testID="recording-review-actions" style={{ flexDirection: "row", gap: 16 }}>
          <FormButton label="Record Again" onPress={onRetake} variant="secondary" style={{ flex: 1, minHeight: 62, borderRadius: 13 }} />
          <FormButton label="Use Recording" onPress={onUseRecording} style={{ flex: 1, minHeight: 62, borderRadius: 13 }} />
        </View>
      </View>
    </ScrollView>
  );
}
