import { Image } from "expo-image";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ExerciseFamilyIcon } from "@/components/exercise-family-icon";
import { FeedbackSection } from "@/components/feedback-section";
import { FormButton } from "@/components/form-button";
import { FormCard } from "@/components/form-card";
import { FormWordmark } from "@/components/form-wordmark";
import { ScoreRing } from "@/components/score-ring";
import type { TutorialVideo } from "@/features/analysis/api";
import { getResultPresentation } from "@/features/analysis/presentation";
import type { AnalysisResult, CoachingFinding } from "@/features/analysis/result-schema";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

type ResultsScreenProps = {
  result: AnalysisResult;
  onFindingPress: (finding: CoachingFinding) => void;
  onRecordAnother: () => void;
  tutorial?: TutorialVideo | null;
  tutorialLoading?: boolean;
  onOpenTutorial?: (tutorial: TutorialVideo) => void;
};

export function ResultsScreen({ result, onFindingPress, onRecordAnother, tutorial = null, tutorialLoading = false, onOpenTutorial = () => undefined }: ResultsScreenProps) {
  const insets = useSafeAreaInsets();
  const presentation = getResultPresentation(result);

  return (
    <ScrollView
      alwaysBounceVertical
      bounces
      overScrollMode="auto"
      contentContainerStyle={{ gap: spacing.lg, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl, paddingHorizontal: spacing.lg }}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <View style={{ alignItems: "center" }}><FormWordmark /></View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <ExerciseFamilyIcon family={result.recognition.exerciseFamily} size={72} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 0.8 }]}>{presentation.status === "complete" ? "ANALYSIS COMPLETE" : presentation.status === "partial" ? "VISIBLE MOVEMENT REVIEW" : "RECORDING UNUSABLE"}</Text>
          <Text selectable style={[typography.heading, { color: colors.text }]}>{presentation.exerciseLabel}</Text>
        </View>
        {presentation.score !== null ? <ScoreRing score={presentation.score} size={82} /> : null}
      </View>

      {presentation.overallAssessment ? <FormCard><Text selectable style={[typography.heading, { color: colors.text }]}>Overall assessment</Text><Text selectable style={[typography.body, { color: colors.textSecondary }]}>{presentation.overallAssessment}</Text></FormCard> : null}

      {presentation.status === "unable" ? <FormCard style={{ borderColor: colors.gold }}><Text selectable style={[typography.caption, { color: colors.gold }]}>RECORDING UNUSABLE</Text><Text selectable style={[typography.heading, { color: colors.text }]}>{presentation.retryReason ?? "The movement was not visible enough for form coaching."}</Text><Text selectable style={[typography.body, { color: colors.textSecondary }]}>{presentation.retryInstruction ?? "Keep the working joints in frame and try again."}</Text></FormCard> : null}

      <FeedbackSection title="Fix first" findings={presentation.priorityCorrections} onFindingPress={onFindingPress} />
      <FeedbackSection title="What worked" findings={presentation.didWell} onFindingPress={onFindingPress} />
      <FeedbackSection title="Next-set cues" findings={presentation.coachingCues} onFindingPress={onFindingPress} />

      {presentation.comparison ? <FormCard><Text selectable style={[typography.caption, { color: colors.gold }]}>SINCE YOUR LAST SET</Text><Text selectable style={[typography.body, { color: colors.textSecondary }]}>{presentation.comparison.summary}</Text></FormCard> : null}

      {presentation.status !== "unable" ? (
        <View style={{ gap: spacing.sm }}>
          <Text selectable style={[typography.heading, { color: colors.text }]}>How to do this exercise properly</Text>
          {tutorial ? (
            <Pressable accessibilityRole="link" accessibilityLabel={`Watch ${tutorial.title} on YouTube`} onPress={() => onOpenTutorial(tutorial)} style={({ pressed }) => ({ overflow: "hidden", borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised, opacity: pressed ? 0.75 : 1 })}>
              <View style={{ height: 168 }}>
                <Image source={{ uri: tutorial.thumbnailUrl }} contentFit="cover" style={{ width: "100%", height: "100%" }} />
                <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.18)" }}><View style={{ width: 54, height: 54, alignItems: "center", justifyContent: "center", borderRadius: 27, backgroundColor: colors.gold }}><Text style={{ color: colors.background, fontSize: 22, marginLeft: 3 }}>▶</Text></View></View>
              </View>
              <View style={{ gap: spacing.xs, padding: spacing.md }}>
                <Text selectable numberOfLines={2} style={[typography.label, { color: colors.text }]}>{tutorial.title}</Text>
                <Text selectable style={[typography.caption, { color: colors.gold }]}>{tutorial.channel} · YouTube</Text>
                <Text selectable numberOfLines={2} style={[typography.caption, { color: colors.textSecondary }]}>{tutorial.whyChosen}</Text>
              </View>
            </Pressable>
          ) : tutorialLoading ? <FormCard><Text selectable style={[typography.body, { color: colors.textSecondary }]}>Finding a clear technique video…</Text></FormCard> : <FormCard><Text selectable style={[typography.caption, { color: colors.textMuted }]}>A verified tutorial was not available for this movement yet.</Text></FormCard>}
        </View>
      ) : null}

      <FormButton label="Record Another Set" onPress={onRecordAnother} />
    </ScrollView>
  );
}
