import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInRight, FadeOutLeft, LinearTransition } from "react-native-reanimated";

import { FormButton } from "@/components/form-button";
import { FormWordmark } from "@/components/form-wordmark";
import { FullRecording, formatPlaybackTime } from "@/components/full-recording";
import type { TutorialVideo } from "@/features/analysis/api";
import { getResultPresentation } from "@/features/analysis/presentation";
import { buildCoachingReviewPoints, type CoachingReviewPoint, type ReviewFrame, type ReviewPurpose } from "@/features/analysis/review-frames";
import type { AnalysisResult, CoachingFinding } from "@/features/analysis/result-schema";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

type ResultsScreenProps = {
  result: AnalysisResult;
  videoUrl?: string | null;
  durationMs?: number | null;
  onFindingPress: (finding: CoachingFinding) => void;
  onRecordAnother: () => void;
  tutorial?: TutorialVideo | null;
  tutorialLoading?: boolean;
  onOpenTutorial?: (tutorial: TutorialVideo) => void;
  onAskCoach?: () => void;
};

const PURPOSES: { id: ReviewPurpose; label: string }[] = [
  { id: "observed", label: "What happened" },
  { id: "why", label: "Why it matters" },
  { id: "next", label: "What to do next" },
];

function pointFrame(point: CoachingReviewPoint, purpose: ReviewPurpose): ReviewFrame {
  return point[purpose];
}

export function formatAnalysisTimestamp(milliseconds: number): string {
  const totalTenths = Math.max(0, Math.round(milliseconds / 100));
  const minutes = Math.floor(totalTenths / 600);
  const seconds = (totalTenths % 600) / 10;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toFixed(1).padStart(4, "0")}`;
}

export function ResultsScreen({ result, videoUrl = null, durationMs = null, onFindingPress, onRecordAnother, tutorial = null, tutorialLoading = false, onOpenTutorial = () => undefined, onAskCoach = () => undefined }: ResultsScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wideWorkspace = width >= 820;
  const presentation = getResultPresentation(result);
  const points = useMemo(() => buildCoachingReviewPoints(result), [result]);
  const [pointIndex, setPointIndex] = useState(0);
  const [purpose, setPurpose] = useState<ReviewPurpose>("observed");
  const [showVisibility, setShowVisibility] = useState(false);
  const selectedIndex = Math.min(pointIndex, Math.max(0, points.length - 1));
  const point = points[selectedIndex] ?? null;
  const activeFrame = point ? pointFrame(point, purpose) : null;
  const observedFrames = points.map((item) => item.observed);
  const scope = [...result.videoCheck.usableObservations, ...result.videoCheck.limitations.map((item) => `Limited: ${item}`)];
  const remember = point?.observed.finding.cue ?? result.coachingCues.find((item) => item.cue)?.cue ?? null;

  const movePoint = (direction: -1 | 1) => {
    if (points.length === 0) return;
    setPointIndex((selectedIndex + direction + points.length) % points.length);
    setPurpose("observed");
  };
  const selectReviewFrame = (frame: ReviewFrame) => {
    const index = points.findIndex((item) => item.observed.id === frame.id || item.observed.findingId === frame.findingId);
    if (index >= 0) setPointIndex(index);
    setPurpose("observed");
  };

  if (presentation.status === "unable") {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, gap: spacing.xl, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl, paddingHorizontal: spacing.lg }} style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ alignItems: "center" }}><FormWordmark /></View>
        <Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 1.8 }]}>RECORDING UNUSABLE</Text>
        <View style={{ gap: spacing.lg, padding: spacing.xl, borderRadius: radii.lg, borderCurve: "continuous", borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.surface }}>
          <Text selectable style={[typography.heading, { color: colors.text }]}>{presentation.retryReason ?? "The movement could not be reviewed."}</Text>
          <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{presentation.retryInstruction ?? "Record the movement again."}</Text>
          <FormButton label="Record Again" onPress={onRecordAnother} />
        </View>
      </ScrollView>
    );
  }

  const coachingPanel = point && activeFrame ? (
    <View style={{ flex: wideWorkspace ? 1 : undefined, gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <Pressable accessibilityLabel="Previous coaching point" accessibilityRole="button" onPress={() => movePoint(-1)} style={({ pressed }) => ({ width: 60, height: 60, alignItems: "center", justifyContent: "center", borderRadius: 30, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.goldSoft : colors.surface })}><Text style={{ color: colors.text, fontSize: 32 }}>‹</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => onFindingPress(point.observed.finding)} style={{ flex: 1, minHeight: 64, justifyContent: "center", gap: spacing.xs }}>
          <Text selectable style={[typography.label, { color: colors.gold }]}>{selectedIndex + 1} of {points.length}</Text>
          <Text selectable style={[typography.heading, { color: colors.text }]}>{point.observed.finding.title}</Text>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>{point.observed.evidence.phase ?? "Visible moment"} · {formatPlaybackTime(point.observed.timeMs)}</Text>
        </Pressable>
        <Pressable accessibilityLabel="Next coaching point" accessibilityRole="button" onPress={() => movePoint(1)} style={({ pressed }) => ({ width: 60, height: 60, alignItems: "center", justifyContent: "center", borderRadius: 30, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.goldSoft : colors.surface })}><Text style={{ color: colors.text, fontSize: 32 }}>›</Text></Pressable>
      </View>

      <View style={{ overflow: "hidden", borderRadius: radii.lg, borderCurve: "continuous", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
        <View accessibilityRole="tablist" style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: colors.border }}>
          {PURPOSES.map((item) => {
            const selected = item.id === purpose;
            return <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setPurpose(item.id)} style={{ minHeight: 52, flex: 1, alignItems: "center", justifyContent: "center", borderBottomWidth: selected ? 3 : 0, borderColor: colors.gold, paddingHorizontal: spacing.sm }}><Text style={[typography.label, { color: selected ? colors.gold : colors.textSecondary, textAlign: "center" }]}>{item.label}</Text></Pressable>;
          })}
        </View>
        <Animated.View
          accessibilityLabel={`${PURPOSES.find((item) => item.id === purpose)?.label ?? "Coaching"}: ${activeFrame.title}`}
          entering={FadeInRight.duration(180)}
          exiting={FadeOutLeft.duration(140)}
          key={`${point.id}-${purpose}`}
          layout={LinearTransition.duration(180)}
          testID="active-coaching-panel"
        >
          <Pressable accessibilityRole="button" onPress={() => onFindingPress(activeFrame.finding)} style={{ gap: spacing.md, padding: spacing.lg }}>
            <Text selectable style={[typography.heading, { color: colors.text }]}>{activeFrame.title}</Text>
            <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{activeFrame.body}</Text>
            {purpose === "observed" && activeFrame.evidence.coachingNote ? <Text selectable style={[typography.body, { color: colors.text }]}>{activeFrame.evidence.coachingNote}</Text> : null}
            {result.verification?.performed && ["confirmed", "revised"].includes(result.verification.outcome) && (result.verification.checkedFindingId === activeFrame.findingId || result.verification.checkedFindingId === null) ? <Text selectable style={[typography.caption, { color: colors.gold }]}>Evidence checked</Text> : null}
          </Pressable>
        </Animated.View>
      </View>
    </View>
  ) : <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{presentation.overallAssessment}</Text>;

  return (
    <ScrollView alwaysBounceVertical bounces overScrollMode="auto" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: spacing.xl, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl, paddingHorizontal: spacing.lg }} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ alignItems: "center" }}><FormWordmark /></View>

      <View style={{ gap: spacing.md }}>
        <Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 1.8 }]}>COACHING REVIEW</Text>
        <Text selectable style={[typography.title, { color: colors.text }]}>{presentation.exerciseLabel}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.lg }}>
          {presentation.score !== null ? <Text accessibilityLabel={`Movement quality ${presentation.score} out of 100`} selectable style={[typography.title, { color: colors.gold }]}>{presentation.score}<Text style={[typography.body, { color: colors.textSecondary }]}> / 100</Text></Text> : null}
        </View>
        <Text selectable style={[typography.body, { maxWidth: 680, color: colors.textSecondary }]}>Review what happened, why it matters, and what to change next.</Text>
      </View>

      <View testID="coaching-workspace" style={{ flexDirection: wideWorkspace ? "row" : "column", alignItems: "flex-start", gap: spacing.lg }}>
        {videoUrl && durationMs ? (
          <View style={{ width: wideWorkspace ? "48%" : "100%", maxWidth: wideWorkspace ? 560 : undefined }}>
            <FullRecording videoUrl={videoUrl} durationMs={durationMs} reviewFrames={observedFrames} selectedReviewFrame={activeFrame} onSelectReviewFrame={selectReviewFrame} onOpenFinding={onFindingPress} showActiveFrameCard={false} />
          </View>
        ) : null}
        {coachingPanel}
      </View>

      <View style={{ gap: spacing.lg }}>
        <Text selectable style={[typography.heading, { color: colors.text }]}>Set Summary</Text>
        {result.setSummary?.verdict ? <Text selectable style={[typography.body, { maxWidth: 720, color: colors.textSecondary }]}>{result.setSummary.verdict}</Text> : null}
        {result.setContext.sequenceSummary ? (
          <Animated.View entering={FadeInRight.duration(220)} layout={LinearTransition.duration(180)} style={{ gap: spacing.sm, padding: spacing.lg, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
            <Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 1.4 }]}>WHOLE-SET READ</Text>
            <Text selectable style={[typography.body, { color: colors.text }]}>{result.setContext.sequenceSummary}</Text>
            {result.setContext.changeAcrossSet ? <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{result.setContext.changeAcrossSet}</Text> : null}
            {result.setContext.coachingBasis ? <View style={{ gap: spacing.xs, paddingTop: spacing.xs }}><Text selectable style={[typography.caption, { color: colors.textMuted }]}>COACHING BASIS</Text><Text selectable style={[typography.body, { color: colors.textSecondary }]}>{result.setContext.coachingBasis}</Text></View> : null}
          </Animated.View>
        ) : null}
        <View style={{ borderTopWidth: 1, borderColor: colors.border }}>
          {presentation.didWell.map((finding) => <Pressable key={finding.id} accessibilityRole="button" onPress={() => onFindingPress(finding)} style={{ minHeight: 60, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.gold, fontSize: 20 }}>✓</Text><Text selectable style={[typography.body, { flex: 1, color: colors.textSecondary }]}>{finding.title}</Text></Pressable>)}
          {point ? <Pressable accessibilityRole="button" onPress={() => onFindingPress(point.observed.finding)} style={{ minHeight: 60, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.gold, fontSize: 20 }}>→</Text><Text selectable style={[typography.body, { flex: 1, color: colors.textSecondary }]}>Priority: {point.observed.finding.title.toLocaleLowerCase()}</Text></Pressable> : null}
        </View>
        {remember ? <View style={{ gap: spacing.sm, paddingTop: spacing.md }}><Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 1.4 }]}>REMEMBER</Text><Text selectable style={[typography.heading, { color: colors.text }]}>“{remember}”</Text><Text selectable style={[typography.body, { color: colors.textSecondary }]}>{point?.observed.finding.correction}</Text></View> : null}
        {(result.nextSetPlan ?? []).length ? <View style={{ gap: spacing.md, paddingTop: spacing.md }}>
          <Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 1.4 }]}>YOUR NEXT SET</Text>
          {result.nextSetPlan?.map((item, index) => (
            <View key={item.id} style={{ flexDirection: "row", gap: spacing.md, padding: spacing.lg, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
              <View style={{ width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: colors.goldSoft }}><Text selectable style={[typography.label, { color: colors.gold }]}>{index + 1}</Text></View>
              <View style={{ flex: 1, gap: spacing.xs }}><Text selectable style={[typography.heading, { color: colors.text }]}>{item.action}</Text><Text selectable style={[typography.body, { color: colors.textSecondary }]}>{item.rationale}</Text></View>
            </View>
          ))}
        </View> : null}
      </View>

      <View style={{ flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
        <Pressable accessibilityRole="button" onPress={onAskCoach} style={{ minHeight: 72, flex: 1, alignItems: "center", justifyContent: "center", borderRightWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md }}><Text style={[typography.body, { color: colors.text, textAlign: "center" }]}>Ask FORM Coach</Text></Pressable>
        <Pressable accessibilityLabel={tutorial ? `Watch ${tutorial.title} example` : "Watch exercise example"} accessibilityRole="button" disabled={!tutorial} onPress={() => tutorial && onOpenTutorial(tutorial)} style={{ minHeight: 72, flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md, opacity: tutorial || tutorialLoading ? 1 : 0.45 }}><Text style={[typography.body, { color: colors.text, textAlign: "center" }]}>{tutorialLoading ? "Finding Example…" : "Watch Example"}</Text></Pressable>
      </View>

      {scope.length > 0 ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: showVisibility }} onPress={() => setShowVisibility((value) => !value)} style={{ gap: spacing.md, paddingVertical: spacing.lg, borderBottomWidth: 1, borderColor: colors.border }}><View style={{ flexDirection: "row", alignItems: "center" }}><Text selectable style={[typography.body, { flex: 1, color: colors.text }]}>Camera visibility note</Text><Text style={{ color: colors.gold, fontSize: 22 }}>{showVisibility ? "⌃" : "›"}</Text></View>{showVisibility ? scope.map((item) => <Text selectable key={item} style={[typography.body, { color: colors.textSecondary }]}>• {item}</Text>) : null}</Pressable> : null}

      {presentation.comparison ? <View style={{ gap: spacing.sm, padding: spacing.lg, borderRadius: radii.md, borderWidth: 1, borderColor: colors.gold }}><Text selectable style={[typography.caption, { color: colors.gold }]}>SINCE YOUR LAST SET</Text><Text selectable style={[typography.body, { color: colors.text }]}>{presentation.comparison.summary}</Text></View> : null}

      <Pressable accessibilityRole="button" onPress={onRecordAnother} testID="record-another-loop" style={({ pressed }) => ({ minHeight: 72, alignItems: "center", justifyContent: "center", borderRadius: radii.md, backgroundColor: pressed ? colors.goldPressed : colors.gold })}><Text selectable style={[typography.heading, { color: colors.background }]}>Record Another Set</Text></Pressable>
    </ScrollView>
  );
}
