import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
      contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl, paddingHorizontal: spacing.xl }}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <View style={{ alignItems: "center", gap: spacing.sm, marginBottom: spacing.xxl }}>
        <FormWordmark />
        <Text selectable style={[typography.title, { color: colors.text }]}>Analyzing your set</Text>
        <Text selectable style={[typography.body, { color: colors.textSecondary, textAlign: "center" }]}>FORM is reviewing everything this recording makes visible.</Text>
      </View>

      <FormCard style={{ gap: spacing.lg }}>
        {analysisStages.map((item, index) => {
          const itemState = states[index];
          return (
            <View key={item.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: itemState === "pending" ? colors.border : colors.gold,
                  backgroundColor: itemState === "complete" ? colors.gold : "transparent",
                }}
              >
                <Text selectable style={{ color: itemState === "complete" ? colors.background : itemState === "active" ? colors.gold : colors.textMuted, fontSize: 13 }}>
                  {itemState === "complete" ? "✓" : index + 1}
                </Text>
              </View>
              <Text selectable style={[typography.body, { color: itemState === "pending" ? colors.textMuted : colors.text, flex: 1 }]}>{item.label}</Text>
            </View>
          );
        })}
      </FormCard>

      {failureMessage ? (
        <FormCard style={{ gap: spacing.md, marginTop: spacing.lg, borderColor: colors.danger }}>
          <Text selectable style={[typography.body, { color: colors.text }]}>{failureMessage}</Text>
          <Text selectable style={[typography.caption, { color: colors.textSecondary }]}>Your recording is still saved securely.</Text>
          {onRecordAgain ? <FormButton label="Record Again" onPress={onRecordAgain} /> : null}
          {onGoHome ? <FormButton label="Back to Home" variant="ghost" onPress={onGoHome} /> : null}
        </FormCard>
      ) : null}
    </ScrollView>
  );
}
