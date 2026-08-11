import { Image } from "expo-image";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CaptureReferenceIcon } from "@/components/capture-reference-icon";
import { CaptureScreenHeader } from "@/components/capture-screen-header";
import { FormButton } from "@/components/form-button";
import type { ExerciseGuide, TutorialVideo } from "@/features/analysis/api";
import { formatExerciseFamily } from "@/features/exercises/exercise-family";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

type ExerciseGuideScreenProps = {
  exerciseName: string;
  guide: ExerciseGuide | null;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onRetry: () => void;
  onContinue: () => void;
  onOpenSpaceHelp: () => void;
  onOpenTutorial: (tutorial: TutorialVideo) => void;
};

type GuideTab = "setup" | "form" | "safety";

const guideTabs: readonly { key: GuideTab; label: string; accessibilityLabel: string }[] = [
  { key: "setup", label: "Setup", accessibilityLabel: "Show setup steps" },
  { key: "form", label: "Form", accessibilityLabel: "Show form steps" },
  { key: "safety", label: "Safety", accessibilityLabel: "Show safety steps" },
];

function TutorialCard({ tutorial, onOpen }: { tutorial: TutorialVideo; onOpen: () => void }) {
  return (
    <Pressable
      accessibilityLabel={`Play ${tutorial.title} on YouTube`}
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => ({
        overflow: "hidden",
        borderRadius: radii.lg,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: "#3A3A3A",
        backgroundColor: colors.surface,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View style={{ aspectRatio: 16 / 9, backgroundColor: colors.surfaceRaised }}>
        <Image source={{ uri: tutorial.thumbnailUrl }} contentFit="cover" style={{ width: "100%", height: "100%" }} />
        <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.12)" }}>
          <View style={{ width: 66, height: 66, borderRadius: 33, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(200,169,107,0.92)" }}>
            <View style={{ marginLeft: 4 }}><CaptureReferenceIcon name="play" color="#FFFFFF" size={31} /></View>
          </View>
        </View>
      </View>
      <View style={{ gap: 2, paddingHorizontal: 12, paddingVertical: 10 }}>
        <Text numberOfLines={1} selectable style={[typography.label, { color: colors.text, fontSize: 15, lineHeight: 20 }]}>
          {tutorial.title}
        </Text>
        <Text numberOfLines={1} selectable style={[typography.body, { color: colors.textSecondary, fontSize: 13, lineHeight: 18 }]}>
          {tutorial.channel}
        </Text>
      </View>
    </Pressable>
  );
}

export function ExerciseGuideScreen({
  exerciseName,
  guide,
  loading,
  error,
  onBack,
  onRetry,
  onContinue,
  onOpenSpaceHelp,
  onOpenTutorial,
}: ExerciseGuideScreenProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const compact = height < 760;
  const [activeTab, setActiveTab] = useState<GuideTab>("form");
  const steps = guide
    ? activeTab === "setup"
      ? guide.setup
      : activeTab === "safety"
        ? guide.safety
        : guide.execution
    : [];
  const cameraSummary = guide?.cameraPlacement.filter(Boolean).slice(0, 3).join("  ·  ") ?? "Side view  ·  Hip height  ·  Full body visible";

  return (
    <ScrollView
      alwaysBounceVertical={false}
      bounces={false}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ paddingBottom: insets.bottom + 18 }}
      style={{ flex: 1, backgroundColor: colors.cameraBlack }}
    >
      <CaptureScreenHeader title="Exercise Guide" onBack={onBack} testID="exercise-guide-header" />
      <View style={{ gap: compact ? 10 : 14, paddingHorizontal: 20 }}>
        <View style={{ gap: 1 }}>
          <Text selectable style={[typography.title, { color: colors.text, fontSize: 26, lineHeight: 31, letterSpacing: -0.7 }]}>
            {exerciseName}
          </Text>
          {guide ? (
            <Text selectable style={[typography.body, { color: colors.gold, fontSize: 16, lineHeight: 21 }]}>
              {formatExerciseFamily(guide.exercise.family)}
            </Text>
          ) : null}
        </View>

        {guide?.tutorial ? <TutorialCard tutorial={guide.tutorial} onOpen={() => onOpenTutorial(guide.tutorial!)} /> : null}

        {loading ? (
          <View style={{ minHeight: compact ? 190 : 230, alignItems: "center", justifyContent: "center", gap: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
            <ActivityIndicator accessibilityLabel="Loading exercise guide" color={colors.gold} />
            <Text selectable style={[typography.body, { color: colors.textSecondary }]}>Preparing your exercise guide…</Text>
          </View>
        ) : null}

        {guide ? (
          <>
            <View testID="exercise-guide-tabs" style={{ minHeight: 40, flexDirection: "row", padding: 2, borderRadius: 10, borderCurve: "continuous", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
              {guideTabs.map((tab) => {
                const active = tab.key === activeTab;
                return (
                  <Pressable
                    key={tab.key}
                    accessibilityLabel={tab.accessibilityLabel}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    onPress={() => setActiveTab(tab.key)}
                    style={{ flex: 1, minHeight: 34, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: active ? colors.gold : "transparent" }}
                  >
                    <Text selectable style={[typography.label, { color: active ? colors.cameraBlack : colors.text, fontSize: 13 }]}>{tab.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View testID="exercise-guide-steps" style={{ overflow: "hidden", borderRadius: 16, borderCurve: "continuous", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
              {steps.map((step, index) => (
                <View key={`${activeTab}-${index}`} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: "#343434" }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.goldSoft }}>
                    <Text selectable style={[typography.heading, { color: colors.gold, fontSize: 17, lineHeight: 21 }]}>{index + 1}</Text>
                  </View>
                  <Text selectable style={[typography.body, { flex: 1, color: colors.text, fontSize: 14, lineHeight: 19 }]}>{step}</Text>
                </View>
              ))}
            </View>

            <Pressable
              accessibilityLabel="Open camera setup help"
              accessibilityRole="button"
              onPress={onOpenSpaceHelp}
              testID="exercise-guide-camera-card"
              style={({ pressed }) => ({
                minHeight: 72,
                flexDirection: "row",
                alignItems: "center",
                gap: 13,
                paddingHorizontal: 16,
                paddingVertical: 11,
                borderRadius: 16,
                borderCurve: "continuous",
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                opacity: pressed ? 0.84 : 1,
              })}
            >
              <CaptureReferenceIcon name="camera" size={36} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text selectable style={[typography.label, { color: colors.text, fontSize: 15, lineHeight: 20 }]}>Camera Setup</Text>
                <Text numberOfLines={2} selectable style={[typography.caption, { color: colors.textSecondary, fontSize: 12, lineHeight: 17 }]}>{cameraSummary}</Text>
              </View>
              <CaptureReferenceIcon name="chevron" size={21} />
            </Pressable>
          </>
        ) : null}

        {error && !loading ? (
          <View style={{ minHeight: 180, justifyContent: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radii.lg, borderCurve: "continuous", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
            <Text accessibilityRole="alert" selectable style={[typography.body, { color: colors.textSecondary }]}>We couldn’t load the exercise-specific guide. Retry, or continue with the standard camera setup.</Text>
            <FormButton label="Retry guide" onPress={onRetry} variant="secondary" />
          </View>
        ) : null}

        <FormButton label="Continue to Camera" onPress={onContinue} style={{ minHeight: 62, borderRadius: 13 }} />
      </View>
    </ScrollView>
  );
}
