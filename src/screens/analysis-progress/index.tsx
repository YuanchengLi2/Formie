import { ScrollView, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnalysisFigure } from "@/components/analysis-figure";
import { FormButton } from "@/components/form-button";
import { FormCard } from "@/components/form-card";
import { FormWordmark } from "@/components/form-wordmark";
import { analysisStages, getAnalysisStageState } from "@/features/analysis/stages";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

type AnalysisProgressScreenProps = {
  stage: string | null;
  failureMessage: string | null;
  onRecordAgain?: () => void;
  onGoHome?: () => void;
};

export function AnalysisProgressScreen({ stage, failureMessage, onRecordAgain, onGoHome }: AnalysisProgressScreenProps) {
  const insets = useSafeAreaInsets();
  const states = getAnalysisStageState(stage);

  return (
    <ScrollView
      alwaysBounceVertical
      bounces
      overScrollMode="auto"
      contentContainerStyle={{ flexGrow: 1, gap: spacing.lg, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg, paddingHorizontal: spacing.lg }}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <View style={{ alignItems: "center" }}><FormWordmark /></View>
      <Animated.View entering={FadeInDown.duration(220)} style={{ alignItems: "center", gap: spacing.xs }}>
        <Text selectable style={[typography.title, { color: colors.text, textAlign: "center" }]}>Analyzing your set</Text>
        <Text selectable style={[typography.caption, { color: colors.textSecondary, textAlign: "center" }]}>Reviewing everything your recording makes visible.</Text>
      </Animated.View>

      <AnalysisFigure />

      <View style={{ gap: 0 }}>
        {analysisStages.map((item, index) => {
          const itemState = states[index];
          return (
            <Animated.View entering={FadeIn.duration(180).delay(index * 35)} key={item.id} style={{ minHeight: 58, flexDirection: "row", gap: spacing.md }}>
              <View style={{ width: 24, alignItems: "center" }}>
                <View style={{ width: 20, height: 20, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: itemState === "active" ? 0 : 1, borderColor: itemState === "pending" ? colors.textMuted : colors.gold, backgroundColor: itemState === "active" ? colors.gold : "transparent" }}>
                  <Text selectable style={{ color: itemState === "active" ? colors.background : itemState === "complete" ? colors.gold : colors.textMuted, fontSize: 11 }}>{itemState === "complete" ? "✓" : ""}</Text>
                </View>
                {index < analysisStages.length - 1 ? <View style={{ flex: 1, width: 1, marginVertical: 4, backgroundColor: itemState === "complete" ? colors.gold : colors.border }} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: spacing.md }}>
                <Text selectable style={[typography.body, { color: itemState === "pending" ? colors.textMuted : colors.text }]}>{item.label}</Text>
                {itemState === "active" ? <View style={{ height: 2, marginTop: spacing.sm, overflow: "hidden", backgroundColor: colors.border }}><View style={{ width: "68%", height: 2, backgroundColor: colors.gold }} /></View> : null}
              </View>
            </Animated.View>
          );
        })}
      </View>

      {failureMessage ? (
        <FormCard style={{ gap: spacing.md, borderColor: colors.danger }}>
          <Text selectable style={[typography.heading, { color: colors.text }]}>Analysis paused</Text>
          <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{failureMessage}</Text>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>Your recording is still saved securely.</Text>
          {onRecordAgain ? <FormButton label="Record Again" onPress={onRecordAgain} /> : null}
          {onGoHome ? <FormButton label="Back to Home" variant="ghost" onPress={onGoHome} /> : null}
        </FormCard>
      ) : <Text selectable style={[typography.caption, { color: colors.textMuted, textAlign: "center" }]}>This usually takes a moment</Text>}
    </ScrollView>
  );
}
