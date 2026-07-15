import { useState } from "react";
import { Modal, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FeedbackSection } from "@/components/feedback-section";
import { FormButton } from "@/components/form-button";
import { FormCard } from "@/components/form-card";
import { FormWordmark } from "@/components/form-wordmark";
import { ScoreRing } from "@/components/score-ring";
import type { AnalysisResult, CoachingFinding } from "@/features/analysis/result-schema";
import { getResultPresentation } from "@/features/analysis/presentation";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

type ResultsScreenProps = {
  result: AnalysisResult;
  onFindingPress: (finding: CoachingFinding) => void;
  onRecordAnother: () => void;
  onCorrectLabel: (label: string) => void | Promise<void>;
};

export function ResultsScreen({ result, onFindingPress, onRecordAnother, onCorrectLabel }: ResultsScreenProps) {
  const insets = useSafeAreaInsets();
  const presentation = getResultPresentation(result);
  const [editingLabel, setEditingLabel] = useState(false);
  const [label, setLabel] = useState(result.recognition.label ?? "");

  const saveLabel = async () => {
    const cleaned = label.trim();
    if (!cleaned) return;
    await onCorrectLabel(cleaned);
    setEditingLabel(false);
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={{ gap: spacing.xl, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxl, paddingHorizontal: spacing.lg }}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <View style={{ alignItems: "center", gap: spacing.sm }}>
          <FormWordmark />
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>{presentation.status === "complete" ? "ANALYSIS COMPLETE" : presentation.status === "partial" ? "ANALYSIS FROM VISIBLE MOVEMENT" : "RECORDING GUIDANCE"}</Text>
          <Text selectable style={[typography.title, { color: colors.text, textAlign: "center" }]}>{presentation.exerciseLabel}</Text>
          <FormButton label="Correct exercise name" variant="ghost" onPress={() => setEditingLabel(true)} />
          {presentation.score !== null ? <ScoreRing score={presentation.score} /> : null}
        </View>

        {presentation.overallAssessment ? (
          <FormCard>
            <Text selectable style={[typography.heading, { color: colors.text }]}>Overall assessment</Text>
            <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{presentation.overallAssessment}</Text>
          </FormCard>
        ) : null}

        {presentation.viewNote ? (
          <FormCard style={{ borderColor: colors.goldSoft }}>
            <Text selectable style={[typography.caption, { color: colors.gold }]}>WHAT THIS ANGLE SHOWED</Text>
            <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{presentation.viewNote}</Text>
          </FormCard>
        ) : null}

        {presentation.status === "unable" ? (
          <FormCard style={{ borderColor: colors.gold }}>
            <Text selectable style={[typography.heading, { color: colors.text }]}>{presentation.retryReason ?? "The movement was not visible enough for form coaching."}</Text>
            <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{presentation.retryInstruction ?? "Keep the working joints in frame and try again."}</Text>
          </FormCard>
        ) : null}

        <FeedbackSection title="What you did well" findings={presentation.didWell} onFindingPress={onFindingPress} />
        <FeedbackSection title="Priority improvements" findings={presentation.priorityCorrections} onFindingPress={onFindingPress} />
        <FeedbackSection title="Coaching" findings={presentation.coachingCues} onFindingPress={onFindingPress} />

        {presentation.comparison ? (
          <FormCard>
            <Text selectable style={[typography.caption, { color: colors.gold }]}>SINCE YOUR LAST SET</Text>
            <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{presentation.comparison.summary}</Text>
          </FormCard>
        ) : null}

        <FormButton label="Record Another Set" onPress={onRecordAnother} />
      </ScrollView>

      <Modal animationType="slide" transparent visible={editingLabel} onRequestClose={() => setEditingLabel(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.65)" }}>
          <View style={{ gap: spacing.lg, padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, backgroundColor: colors.surfaceRaised }}>
            <Text selectable style={[typography.title, { color: colors.text }]}>Correct exercise name</Text>
            <Text selectable style={[typography.body, { color: colors.textSecondary }]}>This improves history without erasing what FORM originally detected.</Text>
            <TextInput accessibilityLabel="Exercise name" autoFocus onChangeText={setLabel} value={label} placeholder="Exercise name" placeholderTextColor={colors.textMuted} style={[typography.body, { minHeight: 54, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, color: colors.text, backgroundColor: colors.background }]} />
            <FormButton label="Save Correction" onPress={() => void saveLabel()} />
            <FormButton label="Cancel" variant="ghost" onPress={() => setEditingLabel(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}
