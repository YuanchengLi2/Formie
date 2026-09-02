import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Text, View } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { HapticPressable as Pressable } from "@/components/haptic-pressable";

import { CaptureReferenceIcon } from "@/components/capture-reference-icon";
import { CaptureScreenHeader } from "@/components/capture-screen-header";
import { FormButton } from "@/components/form-button";
import { ResponsiveScreen } from "@/components/responsive-screen";
import type { ExerciseGuide, TutorialVideo } from "@/features/analysis/api";
import { formatExerciseFamily } from "@/features/exercises/exercise-family";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";
import { usePhoneLayoutProfile } from "@/theme/responsive";

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

type GuideTab = "setup" | "form";

const guideTabs: readonly { key: GuideTab; label: string; accessibilityLabel: string }[] = [
  { key: "setup", label: "Setup", accessibilityLabel: "Show setup steps" },
  { key: "form", label: "Form", accessibilityLabel: "Show form steps" },
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
        <Text selectable style={[typography.caption, { color: "#FF4E45", fontWeight: "800", letterSpacing: 0.4 }]}>YouTube</Text>
        <Text numberOfLines={1} selectable style={[typography.label, { color: colors.text, fontSize: 15, lineHeight: 20 }]}>
          {tutorial.title}
        </Text>
        <Text numberOfLines={1} selectable style={[typography.body, { color: colors.textSecondary, fontSize: 13, lineHeight: 18 }]}>
          {tutorial.channel}
        </Text>
        <Text selectable style={[typography.caption, { color: colors.gold, marginTop: 4, fontWeight: "700" }]}>Watch on YouTube</Text>
      </View>
    </Pressable>
  );
}

function GuideSkeleton() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const opacity = useSharedValue(0.52);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  useEffect(() => {
    const getPreference = AccessibilityInfo.isReduceMotionEnabled;
    if (typeof getPreference === "function") {
      void getPreference().then(setReducedMotion).catch(() => undefined);
    }
  }, []);
  useEffect(() => {
    if (reducedMotion) {
      opacity.value = 0.62;
      return () => cancelAnimation(opacity);
    }
    opacity.value = withRepeat(withTiming(0.9, { duration: 850 }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity, reducedMotion]);

  const bar = (width: `${number}%` | number, height = 14) => (
    <Animated.View style={[{ width, height, borderRadius: 7, backgroundColor: colors.surfaceRaised }, animatedStyle]} />
  );
  return (
    <Animated.View accessibilityLabel="Loading exercise guide" testID="exercise-guide-skeleton" style={[{ gap: spacing.lg }, animatedStyle]}>
      <View style={{ overflow: "hidden", aspectRatio: 16 / 9, borderRadius: radii.lg, backgroundColor: colors.surfaceRaised }} />
      <View style={{ height: 44, flexDirection: "row", gap: spacing.sm }}>
        {bar("50%", 44)}
        {bar("50%", 44)}
      </View>
      <View style={{ gap: spacing.md }}>
        {[0, 1, 2].map((index) => (
          <View key={index} testID={`exercise-guide-skeleton-step-${index}`} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            {bar(28, 20)}
            {bar(index === 1 ? "82%" : "92%", 18)}
          </View>
        ))}
      </View>
      <View style={{ height: 66, borderRadius: radii.lg, backgroundColor: colors.surfaceRaised }} />
    </Animated.View>
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
  const layout = usePhoneLayoutProfile();
  const compact = layout.compact || layout.short;
  const [activeTab, setActiveTab] = useState<GuideTab>("form");
  const steps = guide
    ? activeTab === "setup"
      ? guide.setup
      : guide.execution
    : [];
  const cameraSummary = guide?.cameraPlacement.filter(Boolean).slice(0, 3).join("  ·  ") ?? "Side view  ·  Hip height  ·  Full body visible";

  return (
    <ResponsiveScreen
      testID="exercise-guide-responsive-screen"
      alwaysBounceVertical={false}
      bounces={false}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ gap: compact ? 10 : 14, paddingTop: Math.max(layout.insets.top, 8) }}
      style={{ flex: 1, backgroundColor: colors.cameraBlack }}
    >
      <CaptureScreenHeader title="Exercise Guide" onBack={onBack} testID="exercise-guide-header" />
      <View style={{ gap: compact ? 12 : 16 }}>
        <View style={{ gap: 1 }}>
          <Text selectable style={[typography.title, { color: colors.text, fontSize: 26, lineHeight: 31, letterSpacing: -0.7 }]}>
            {exerciseName}
          </Text>
          {guide ? (
            <Text selectable style={[typography.body, { color: colors.gold, fontSize: 16, lineHeight: 21 }]}>
              {formatExerciseFamily(guide.exercise.family)}
            </Text>
          ) : loading ? <View style={{ width: 110, height: 17, borderRadius: 8, backgroundColor: colors.surfaceRaised }} /> : null}
        </View>

        {guide?.tutorial ? <TutorialCard tutorial={guide.tutorial} onOpen={() => onOpenTutorial(guide.tutorial!)} /> : null}

        {loading ? <GuideSkeleton /> : guide ? (
          <>
            <View testID="exercise-guide-tabs" style={{ minHeight: 44, flexDirection: "row", padding: 2, borderRadius: 10, borderCurve: "continuous", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
              {guideTabs.map((tab) => {
                const active = tab.key === activeTab;
                return (
                  <Pressable
                    key={tab.key}
                    accessibilityLabel={tab.accessibilityLabel}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    onPress={() => setActiveTab(tab.key)}
                    hitSlop={4}
                    style={{ flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: active ? colors.gold : "transparent" }}
                  >
                    <Text selectable style={[typography.label, { color: active ? colors.cameraBlack : colors.text, fontSize: 13 }]}>{tab.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ gap: 5 }}>
              <Text selectable style={[typography.label, { color: colors.gold, fontSize: 13, lineHeight: 18, letterSpacing: 1.1 }]}>{activeTab === "setup" ? "SETUP STEPS" : "FORM STEPS"}</Text>
            <View testID="exercise-guide-steps" style={{ gap: spacing.lg }}>
              {steps.map((step, index) => (
                <View key={`${activeTab}-${index}`} testID={`exercise-guide-step-${index}`} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 0 }}>
                  <Text selectable style={[typography.heading, { width: 22, color: colors.gold, fontSize: 12, lineHeight: 20, letterSpacing: 0.6 }]}>{String(index + 1).padStart(2, "0")}</Text>
                  <Text selectable style={[typography.body, { flex: 1, color: colors.text, fontSize: 15, lineHeight: 22 }]}>{step}</Text>
                </View>
              ))}
            </View>
            </View>

            <Pressable
              accessibilityLabel="Open camera setup help"
              accessibilityRole="button"
              onPress={onOpenSpaceHelp}
              testID="exercise-guide-camera-card"
              style={({ pressed }) => ({
                minHeight: 60,
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

        <FormButton label="Continue to Camera" onPress={onContinue} style={{ minHeight: 56, borderRadius: 13 }} />
      </View>
    </ResponsiveScreen>
  );
}
