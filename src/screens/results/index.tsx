import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FormButton } from "@/components/form-button";
import { FormWordmark } from "@/components/form-wordmark";
import { FullRecording, formatPlaybackTime } from "@/components/full-recording";
import type { TutorialVideo } from "@/features/analysis/api";
import { getResultPresentation } from "@/features/analysis/presentation";
import { buildCoachingReviewPoints, type CoachingReviewPoint, type ReviewFrame, type ReviewPurpose } from "@/features/analysis/review-frames";
import type { AnalysisResult, CoachingFinding, PrecisionReview } from "@/features/analysis/result-schema";
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

function PremiumRunsBadge({ review }: { review: PrecisionReview }) {
  const completed = review.passes.filter((pass) => pass.outcome !== "failed").length;
  const failed = review.status === "failed" || review.status === "partial";
  return (
    <View accessibilityLabel="Premium review usage" style={{ alignSelf: "flex-start", gap: 2, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radii.sm, borderWidth: 1, borderColor: failed ? colors.danger : colors.border, backgroundColor: colors.surface }}>
      <Text selectable style={[typography.caption, { color: colors.gold }]}>{review.runsUsed} {review.runsUsed === 1 ? "premium run" : "premium runs"}</Text>
      {failed ? <Text selectable style={[typography.caption, { color: colors.textSecondary }]}>{review.runsUsed} attempted · {completed} completed</Text> : null}
      {review.status === "failed" ? <Text selectable style={[typography.caption, { color: colors.danger }]}>Stopped after review failure</Text> : review.status === "partial" ? <Text selectable style={[typography.caption, { color: colors.danger }]}>Stopped after a partial review</Text> : null}
    </View>
  );
}

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
  const selectTimelineFrame = (frame: ReviewFrame) => {
    const index = points.findIndex((item) => item.observed.id === frame.id);
    if (index >= 0) setPointIndex(index);
    setPurpose("observed");
  };

  if (presentation.status === "unable") {
    return (
      <ScrollView contentContainerStyle={{ flexGrow: 1, gap: spacing.xl, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl, paddingHorizontal: spacing.lg }} style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ alignItems: "center" }}><FormWordmark /></View>
        <Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 1.8 }]}>RECORDING UNUSABLE</Text>
        <View style={{ gap: spacing.md, padding: spacing.lg, borderRadius: radii.md, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.surface }}>
          <Text selectable style={[typography.heading, { color: colors.text }]}>{presentation.retryReason ?? "The movement could not be reviewed."}</Text>
          <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{presentation.retryInstruction ?? "Record the movement again."}</Text>
          <FormButton label="Record Again" onPress={onRecordAnother} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView alwaysBounceVertical bounces overScrollMode="auto" contentContainerStyle={{ gap: spacing.lg, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl, paddingHorizontal: spacing.lg }} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ alignItems: "center" }}><FormWordmark /></View>

      <View style={{ gap: spacing.sm }}>
        <Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 1.8 }]}>COACHING REVIEW</Text>
        <Text selectable style={[typography.title, { color: colors.text }]}>{presentation.exerciseLabel}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.md }}>
          {presentation.score !== null ? <Text accessibilityLabel={`Movement quality ${presentation.score} out of 100`} selectable style={[typography.title, { color: colors.gold }]}>{presentation.score}<Text style={[typography.body, { color: colors.textSecondary }]}> / 100</Text></Text> : null}
          <View style={{ width: 1, height: 34, backgroundColor: colors.border }} />
          <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{points.length} {points.length === 1 ? "coaching point" : "coaching points"}</Text>
          {result.precisionReview ? <PremiumRunsBadge review={result.precisionReview} /> : null}
        </View>
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>Review what happened, why it matters, and what to change next.</Text>
      </View>

      {videoUrl && durationMs ? (
        <FullRecording
          videoUrl={videoUrl}
          reps={result.repTimeline ?? []}
          durationMs={durationMs}
          reviewFrames={observedFrames}
          selectedReviewFrame={activeFrame}
          onSelectReviewFrame={selectTimelineFrame}
          onOpenFinding={onFindingPress}
        />
      ) : null}

      {point && activeFrame ? (
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <Pressable accessibilityLabel="Previous coaching point" accessibilityRole="button" onPress={() => movePoint(-1)} style={{ width: 56, height: 56, alignItems: "center", justifyContent: "center", borderRadius: 28, borderWidth: 1, borderColor: colors.textMuted }}><Text style={{ color: colors.text, fontSize: 30 }}>‹</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => onFindingPress(point.observed.finding)} style={{ flex: 1, alignItems: "center", gap: 2 }}>
              <Text selectable style={[typography.caption, { color: colors.textSecondary }]}>{selectedIndex + 1} of {points.length}</Text>
              <Text selectable style={[typography.heading, { color: colors.text, textAlign: "center" }]}>{point.observed.finding.title}</Text>
              <Text selectable style={[typography.caption, { color: colors.textMuted }]}>{point.observed.evidence.phase ?? "Visible moment"}{point.observed.evidence.repNumber ? ` · Rep ${point.observed.evidence.repNumber}` : ""} · {formatPlaybackTime(point.observed.timeMs)}</Text>
            </Pressable>
            <Pressable accessibilityLabel="Next coaching point" accessibilityRole="button" onPress={() => movePoint(1)} style={{ width: 56, height: 56, alignItems: "center", justifyContent: "center", borderRadius: 28, borderWidth: 1, borderColor: colors.textMuted }}><Text style={{ color: colors.text, fontSize: 30 }}>›</Text></Pressable>
          </View>

          <View style={{ overflow: "hidden", borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
            <View accessibilityRole="tablist" style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: colors.border }}>
              {PURPOSES.map((item) => {
                const selected = item.id === purpose;
                return <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setPurpose(item.id)} style={{ minHeight: 52, flex: 1, alignItems: "center", justifyContent: "center", borderBottomWidth: selected ? 2 : 0, borderColor: colors.gold, paddingHorizontal: spacing.xs }}><Text style={[typography.label, { color: selected ? colors.gold : colors.textSecondary, textAlign: "center" }]}>{item.label}</Text></Pressable>;
              })}
            </View>
            <Pressable accessibilityRole="button" onPress={() => onFindingPress(activeFrame.finding)} style={{ gap: spacing.sm, padding: spacing.lg }}>
              <Text selectable style={[typography.body, { color: colors.text }]}>{activeFrame.body}</Text>
              {purpose === "observed" && activeFrame.evidence.coachingNote ? <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{activeFrame.evidence.coachingNote}</Text> : null}
              {result.verification?.performed && ["confirmed", "revised"].includes(result.verification.outcome) && result.verification.checkedFindingId === activeFrame.findingId ? <Text selectable style={[typography.caption, { color: colors.gold }]}>Evidence checked</Text> : null}
            </Pressable>
          </View>
        </View>
      ) : (
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{presentation.overallAssessment}</Text>
      )}

      <View style={{ gap: spacing.sm }}>
        <Text selectable style={[typography.heading, { color: colors.text }]}>Set Summary</Text>
        {result.setSummary?.verdict ? <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{result.setSummary.verdict}</Text> : null}
        {result.setSummary?.totalReps && result.setSummary.consistentReps !== null ? <Text selectable style={[typography.caption, { color: colors.textMuted }]}>{result.setSummary.consistentReps} of {result.setSummary.totalReps} reps consistent</Text> : null}
        <View style={{ borderTopWidth: 1, borderColor: colors.border }}>
          {presentation.didWell.map((finding) => <Pressable key={finding.id} accessibilityRole="button" onPress={() => onFindingPress(finding)} style={{ minHeight: 52, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.gold, fontSize: 18 }}>✓</Text><Text selectable style={[typography.body, { flex: 1, color: colors.textSecondary }]}>{finding.title}</Text></Pressable>)}
          {point ? <Pressable accessibilityRole="button" onPress={() => onFindingPress(point.observed.finding)} style={{ minHeight: 52, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: 1, borderColor: colors.border }}><View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: colors.gold }} /><Text selectable style={[typography.body, { flex: 1, color: colors.textSecondary }]}>Priority: {point.observed.finding.title.toLocaleLowerCase()}</Text></Pressable> : null}
        </View>
        {remember ? <View style={{ gap: spacing.xs, paddingTop: spacing.md }}><Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 1.4 }]}>REMEMBER</Text><Text selectable style={[typography.heading, { color: colors.text }]}>“{remember}”</Text><Text selectable style={[typography.body, { color: colors.textSecondary }]}>{point?.observed.finding.correction}</Text></View> : null}
      </View>

      <View style={{ flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
        <Pressable accessibilityRole="button" onPress={onAskCoach} style={{ minHeight: 64, flex: 1, alignItems: "center", justifyContent: "center", borderRightWidth: 1, borderColor: colors.border }}><Text style={[typography.body, { color: colors.text }]}>Ask FORM Coach</Text></Pressable>
        <Pressable accessibilityLabel={tutorial ? `Watch ${tutorial.title} example` : "Watch exercise example"} accessibilityRole="button" disabled={!tutorial} onPress={() => tutorial && onOpenTutorial(tutorial)} style={{ minHeight: 64, flex: 1, alignItems: "center", justifyContent: "center", opacity: tutorial || tutorialLoading ? 1 : 0.45 }}><Text style={[typography.body, { color: colors.text }]}>{tutorialLoading ? "Finding Example…" : "Watch Example"}</Text></Pressable>
      </View>

      {scope.length > 0 ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: showVisibility }} onPress={() => setShowVisibility((value) => !value)} style={{ gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: 1, borderColor: colors.border }}><View style={{ flexDirection: "row", alignItems: "center" }}><Text selectable style={[typography.body, { flex: 1, color: colors.text }]}>Camera visibility note</Text><Text style={{ color: colors.gold, fontSize: 22 }}>{showVisibility ? "⌃" : "›"}</Text></View>{showVisibility ? scope.map((item) => <Text selectable key={item} style={[typography.caption, { color: colors.textSecondary }]}>• {item}</Text>) : null}</Pressable> : null}

      {presentation.comparison ? <View style={{ gap: spacing.xs, padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.gold }}><Text selectable style={[typography.caption, { color: colors.gold }]}>SINCE YOUR LAST SET</Text><Text selectable style={[typography.body, { color: colors.text }]}>{presentation.comparison.summary}</Text></View> : null}

      <Pressable accessibilityRole="button" onPress={onRecordAnother} testID="record-another-loop" style={({ pressed }) => ({ minHeight: 72, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, backgroundColor: pressed ? colors.goldPressed : colors.gold })}><Text selectable style={[typography.heading, { color: colors.background }]}>Record Another Set</Text></Pressable>
    </ScrollView>
  );
}
