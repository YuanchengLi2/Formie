import { Image } from "expo-image";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { ExerciseFamilyIcon } from "@/components/exercise-family-icon";
import { FormButton } from "@/components/form-button";
import type { ExerciseGuide, TutorialVideo } from "@/features/analysis/api";
import { formatExerciseFamily, type ExerciseFamily } from "@/features/exercises/exercise-family";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

type ExerciseGuideScreenProps = {
  exerciseName: string;
  guide: ExerciseGuide | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onContinue: () => void;
  onOpenSpaceHelp: () => void;
  onOpenTutorial: (tutorial: TutorialVideo) => void;
};

function GuideSection({ title, steps, family }: { title: string; steps: string[]; family: ExerciseFamily }) {
  return (
    <View style={{ gap: spacing.md, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View style={{ width: 52, height: 52, borderRadius: radii.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceRaised }}>
          <ExerciseFamilyIcon
            family={family}
            size={42}
            accessibilityLabel={`${formatExerciseFamily(family)} movement illustration`}
          />
        </View>
        <Text style={[typography.heading, { color: colors.text, flex: 1 }]}>{title}</Text>
      </View>
      {steps.map((step, index) => (
        <View key={`${title}-${index}`} style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.goldSoft }}>
            <Text style={[typography.label, { color: colors.gold }]}>{index + 1}</Text>
          </View>
          <Text style={[typography.body, { color: colors.textSecondary, flex: 1, paddingTop: 2 }]}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

export function ExerciseGuideScreen({
  exerciseName,
  guide,
  loading,
  error,
  onRetry,
  onContinue,
  onOpenSpaceHelp,
  onOpenTutorial,
}: ExerciseGuideScreenProps) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl }}
    >
      <Text style={[typography.title, { color: colors.text }]}>{exerciseName}</Text>

      {loading ? (
        <View style={{ minHeight: 240, alignItems: "center", justifyContent: "center", gap: spacing.md }}>
          <ActivityIndicator accessibilityLabel="Loading exercise guide" color={colors.gold} />
          <Text style={[typography.body, { color: colors.textSecondary }]}>Preparing your exercise guide…</Text>
        </View>
      ) : null}

      {guide ? (
        <>
          {guide.tutorial ? (
            <Pressable
              accessibilityLabel={`Play ${guide.tutorial.title} on YouTube`}
              accessibilityRole="button"
              onPress={() => onOpenTutorial(guide.tutorial!)}
              style={{ overflow: "hidden", borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
            >
              <View style={{ height: 190, backgroundColor: colors.surfaceRaised }}>
                <Image source={{ uri: guide.tutorial.thumbnailUrl }} contentFit="cover" style={{ width: "100%", height: "100%" }} />
                <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.18)" }}>
                  <View style={{ width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: "#FF0033" }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 25, marginLeft: 3 }}>▶</Text>
                  </View>
                </View>
              </View>
              <View style={{ padding: spacing.lg, gap: spacing.xs }}>
                <Text style={[typography.label, { color: colors.gold }]}>WATCH THE TUTORIAL</Text>
                <Text numberOfLines={2} style={[typography.heading, { color: colors.text }]}>{guide.tutorial.title}</Text>
                <Text style={[typography.body, { color: colors.textSecondary }]}>{guide.tutorial.channel}</Text>
              </View>
            </Pressable>
          ) : (
            <View style={{ height: 180, alignItems: "center", justifyContent: "center", borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
              <ExerciseFamilyIcon
                family={guide.exercise.family}
                size={140}
                accessibilityLabel={`${formatExerciseFamily(guide.exercise.family)} movement illustration`}
              />
            </View>
          )}
          <GuideSection title="Setup" steps={guide.setup} family={guide.exercise.family} />
          <GuideSection title="How to perform it" steps={guide.execution} family={guide.exercise.family} />
          <GuideSection title="Safety" steps={guide.safety} family={guide.exercise.family} />
          <GuideSection title="Camera placement" steps={guide.cameraPlacement} family={guide.exercise.family} />
          <Pressable accessibilityRole="button" onPress={onOpenSpaceHelp} style={{ alignItems: "center", padding: spacing.sm }}>
            <Text style={[typography.label, { color: colors.gold }]}>Need a place for your phone?</Text>
          </Pressable>
        </>
      ) : null}

      {error && !loading ? (
        <View style={{ gap: spacing.md, padding: spacing.lg, borderRadius: radii.md, backgroundColor: colors.surface }}>
          <Text accessibilityRole="alert" style={[typography.body, { color: colors.textSecondary }]}>
            We couldn’t load the exercise-specific guide. You can retry or continue with the standard recording tips.
          </Text>
          <FormButton label="Retry guide" onPress={onRetry} />
        </View>
      ) : null}

      <FormButton label="Continue to Camera Tips" onPress={onContinue} />
    </ScrollView>
  );
}
