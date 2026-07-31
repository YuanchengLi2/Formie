import { ScrollView, Text, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FormButton } from "@/components/form-button";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

type RecordingReviewScreenProps = {
  localVideoUri: string;
  onUseRecording: () => void;
  onRetake: () => void;
};

const reviewTips = [
  {
    title: "Choose an angle that preserves your form",
    detail: "Pick the side that shows your form clearly, then use the angle that keeps the exercise’s perspective true.",
  },
  {
    title: "Keep the full movement visible",
    detail: "Keep your full range of motion, working joints, equipment, and contact points in frame.",
  },
  {
    title: "Keep the phone level and stable",
    detail: "Avoid steep up-or-down angles, close wide-angle views, shaking, and strong perspective distortion.",
  },
  {
    title: "Make important details easy to see",
    detail: "Use clear lighting and enough distance to fit the movement without making your body too small.",
  },
] as const;

export function RecordingReviewScreen({
  localVideoUri,
  onUseRecording,
  onRetake,
}: RecordingReviewScreenProps) {
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer(localVideoUri, (created) => {
    created.loop = true;
  });

  return (
    <ScrollView
      contentContainerStyle={{
        gap: spacing.xl,
        paddingTop: insets.top + spacing.xl,
        paddingBottom: insets.bottom + spacing.xxl,
        paddingHorizontal: spacing.lg,
      }}
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.background }}
      testID="recording-review-scroll"
    >
      <View style={{ gap: spacing.sm }}>
        <Text
          selectable
          style={[
            typography.caption,
            {
              color: colors.gold,
              fontWeight: "700",
              letterSpacing: 2.2,
            },
          ]}
        >
          FINAL CHECK
        </Text>
        <Text
          selectable
          accessibilityRole="header"
          testID="recording-review-title"
          style={[
            typography.title,
            {
              color: colors.text,
              fontSize: 40,
              lineHeight: 43,
              letterSpacing: -1.4,
            },
          ]}
        >
          Is this recording ready?
        </Text>
        <Text selectable style={[typography.body, { color: colors.textSecondary, maxWidth: 350 }]}>
          Watch the clip once. A clear angle gives Formie better evidence and gives you more useful coaching.
        </Text>
      </View>

      <View
        style={{
          height: 260,
          overflow: "hidden",
          borderRadius: radii.lg,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.cameraBlack,
        }}
      >
        <VideoView
          accessibilityLabel="Recorded set preview"
          contentFit="contain"
          nativeControls
          player={player}
          style={{ width: "100%", height: "100%" }}
        />
      </View>

      <View style={{ gap: spacing.md }}>
        <Text selectable style={[typography.heading, { color: colors.text }]}>
          Before you continue
        </Text>
        {reviewTips.map((tip, index) => (
          <View
            key={tip.title}
            style={{
              flexDirection: "row",
              gap: spacing.md,
              alignItems: "flex-start",
              padding: spacing.md,
              borderRadius: radii.md,
              borderCurve: "continuous",
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: radii.pill,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.goldSoft,
              }}
            >
              <Text selectable style={[typography.label, { color: colors.gold }]}>
                {index + 1}
              </Text>
            </View>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text selectable style={[typography.label, { color: colors.text, fontSize: 14 }]}>
                {tip.title}
              </Text>
              <Text selectable style={[typography.caption, { color: colors.textSecondary }]}>
                {tip.detail}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View
        accessibilityRole="alert"
        style={{
          gap: spacing.xs,
          padding: spacing.lg,
          borderRadius: radii.lg,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: colors.gold,
          backgroundColor: colors.goldSoft,
        }}
      >
        <Text
          selectable
          style={[
            typography.caption,
            {
              color: colors.gold,
              fontWeight: "700",
              letterSpacing: 1.3,
            },
          ]}
        >
          ONE ANALYSIS
        </Text>
        <Text selectable style={[typography.heading, { color: colors.text }]}>
          Submitting this recording will use 1 analysis. Make it count.
        </Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        <FormButton label="Use This Recording" onPress={onUseRecording} />
        <FormButton label="Retake" variant="secondary" onPress={onRetake} />
      </View>
    </ScrollView>
  );
}
