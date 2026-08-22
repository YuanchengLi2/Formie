import { Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { FormButton } from "@/components/form-button";
import { FormCard } from "@/components/form-card";
import { AnalysisProgressMotion } from "@/components/analysis-progress-motion";
import { ResponsiveScreen } from "@/components/responsive-screen";
import { analysisProgress } from "@/features/analysis/progress-stages";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";
import { usePhoneLayoutProfile } from "@/theme/responsive";

type AnalysisProgressScreenProps = {
  stage: string | null;
  failureMessage: string | null;
  onRetryAnalysis?: () => void;
  retryingAnalysis?: boolean;
  retryAnalysisError?: string | null;
  onRecordAgain?: () => void;
  onGoHome?: () => void;
  onRetryUpload?: () => void;
};

export function AnalysisProgressScreen({ stage, failureMessage, onRetryAnalysis, retryingAnalysis = false, retryAnalysisError = null, onRecordAgain, onGoHome, onRetryUpload }: AnalysisProgressScreenProps) {
  const layout = usePhoneLayoutProfile();
  const progress = analysisProgress(stage);
  const durableRetry = stage === "retry_wait";

  return (
    <ResponsiveScreen testID="analysis-progress-responsive-screen" contentContainerStyle={{ gap: spacing.xl, paddingTop: spacing.lg }}>
        <Animated.View entering={FadeInDown.duration(220)} style={{ flex: 1, justifyContent: "center", gap: spacing.xxl }}>
          <View style={{ gap: spacing.md }}>
            <Text selectable style={[typography.title, { color: colors.text }]}>Analyzing your movement</Text>
            <Text selectable style={[typography.label, { maxWidth: 560, color: colors.gold }]}>{durableRetry ? "Finishing your coaching. You can leave this screen; we’ll continue automatically." : "Keep Formie open and stay on this page until your coaching is ready."}</Text>
          </View>

          <View
            testID="analysis-progress-motion-surface"
            style={{
              minHeight: layout.short ? 240 : 330,
              overflow: "hidden",
              backgroundColor: colors.background,
            }}
          >
            <AnalysisProgressMotion stage={stage} />
          </View>

          <View accessibilityRole="list" style={{ gap: spacing.sm }}>
            {progress.items.map((item, index) => (
              <Animated.View
                key={item.key}
                entering={FadeInDown.delay(index * 25).duration(180)}
                accessibilityLabel={item.label}
                accessibilityState={{ selected: item.state === "active" }}
                style={{
                  minHeight: 56,
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
      {failureMessage ? (
        <View>
          <FormCard style={{ gap: spacing.md, borderColor: colors.danger, backgroundColor: "rgba(15,15,15,0.97)" }}>
            <Text selectable style={[typography.heading, { color: colors.text }]}>Analysis couldn’t finish</Text>
            <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{failureMessage}</Text>
            <Text selectable style={[typography.caption, { color: colors.textMuted }]}>Your recording is still saved securely.</Text>
            <Text selectable style={[typography.caption, { color: colors.textMuted }]}>This failed attempt did not use an analysis credit.</Text>
            {retryAnalysisError ? <Text accessibilityRole="alert" selectable style={[typography.caption, { color: colors.danger }]}>{retryAnalysisError}</Text> : null}
            {onRetryAnalysis ? <FormButton label={retryingAnalysis ? "Retrying…" : "Retry Analysis"} disabled={retryingAnalysis} onPress={onRetryAnalysis} /> : null}
            {onRetryUpload ? <FormButton label="Retry Upload" onPress={onRetryUpload} /> : null}
            {onRecordAgain ? <FormButton label="Record Again" onPress={onRecordAgain} /> : null}
            {onGoHome ? <FormButton label="Back to Home" variant="ghost" onPress={onGoHome} /> : null}
          </FormCard>
        </View>
      ) : null}
      <Text accessibilityElementsHidden style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}>{stage}</Text>
    </ResponsiveScreen>
  );
}
