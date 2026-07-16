import { Image } from "expo-image";
import { ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FormButton } from "@/components/form-button";
import { FormCard } from "@/components/form-card";
import { FormWordmark } from "@/components/form-wordmark";
import { analysisProgress } from "@/features/analysis/progress-stages";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

const analysisFigure = require("../../../assets/production/analysis-figure.png");

type AnalysisProgressScreenProps = {
  stage: string | null;
  failureMessage: string | null;
  onRecordAgain?: () => void;
  onGoHome?: () => void;
  onRetryUpload?: () => void;
};

export function AnalysisProgressScreen({ stage, failureMessage, onRecordAgain, onGoHome, onRetryUpload }: AnalysisProgressScreenProps) {
  const insets = useSafeAreaInsets();
  const progress = analysisProgress(stage);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.xl,
        }}
      >
        <FormWordmark />
        <Animated.View entering={FadeInDown.duration(380)} style={{ flex: 1, justifyContent: "center", gap: spacing.xl }}>
          <View style={{ gap: spacing.sm }}>
            <Text selectable style={[typography.title, { color: colors.text }]}>Analyzing your movement</Text>
            <Text selectable style={[typography.body, { color: colors.textSecondary }]}>Your recording is ready. FORM is working through each coaching stage.</Text>
          </View>

          <View
            style={{
              minHeight: 180,
              overflow: "hidden",
              borderRadius: radii.lg,
              borderCurve: "continuous",
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <Image
              source={analysisFigure}
              accessibilityLabel="Analysis figure"
              contentFit="cover"
              style={{ width: "100%", height: 210 }}
            />
          </View>

          <View accessibilityRole="list" style={{ gap: spacing.sm }}>
            {progress.items.map((item, index) => (
              <Animated.View
                key={item.key}
                entering={FadeInDown.delay(index * 45).duration(280)}
                accessibilityLabel={item.label}
                accessibilityState={{ selected: item.state === "active" }}
                style={{
                  minHeight: 48,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  paddingHorizontal: spacing.md,
                  borderRadius: radii.md,
                  borderCurve: "continuous",
                  borderWidth: 1,
                  borderColor: item.state === "active" ? colors.gold : colors.border,
                  backgroundColor: item.state === "active" ? colors.goldSoft : "transparent",
                  opacity: item.state === "pending" ? 0.58 : 1,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 11,
                    borderWidth: item.state === "pending" ? 1 : 0,
                    borderColor: colors.textMuted,
                    backgroundColor: item.state === "complete" ? colors.gold : item.state === "active" ? colors.gold : "transparent",
                  }}
                >
                  {item.state === "complete" ? <Text style={{ color: colors.background, fontSize: 13, fontWeight: "800" }}>✓</Text> : null}
                  {item.state === "active" ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.background }} /> : null}
                </View>
                <Text selectable style={[typography.label, { flex: 1, color: item.state === "pending" ? colors.textMuted : colors.text }]}>
                  {item.label}
                </Text>
                {item.state === "active" ? <Text style={[typography.caption, { color: colors.gold }]}>NOW</Text> : null}
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>
      {failureMessage ? (
        <View style={{ position: "absolute", left: spacing.lg, right: spacing.lg, bottom: insets.bottom + spacing.lg }}>
          <FormCard style={{ gap: spacing.md, borderColor: colors.danger, backgroundColor: "rgba(15,15,15,0.97)" }}>
            <Text selectable style={[typography.heading, { color: colors.text }]}>Analysis paused</Text>
            <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{failureMessage}</Text>
            <Text selectable style={[typography.caption, { color: colors.textMuted }]}>Your recording is still saved securely.</Text>
            {onRetryUpload ? <FormButton label="Retry Upload" onPress={onRetryUpload} /> : null}
            {onRecordAgain ? <FormButton label="Record Again" onPress={onRecordAgain} /> : null}
            {onGoHome ? <FormButton label="Back to Home" variant="ghost" onPress={onGoHome} /> : null}
          </FormCard>
        </View>
      ) : null}
      <Text accessibilityElementsHidden style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}>{stage}</Text>
    </View>
  );
}
