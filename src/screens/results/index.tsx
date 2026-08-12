import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FormButton } from "@/components/form-button";
import { FullRecording } from "@/components/full-recording";
import { MuscleFocusFigure } from "@/components/muscle-focus-figure";
import { resolveExerciseMuscleFocus } from "@/features/analysis/exercise-muscle-focus";
import { deriveObservedIssueRegions } from "@/features/analysis/issue-regions";
import { getResultPresentation } from "@/features/analysis/presentation";
import { resolvePlaybackWindow, sourceToClipMs, type PlaybackWindow } from "@/features/analysis/playback-window";
import { buildCoachingReviewPoints, buildReviewFrames, type ReviewFrame, type ReviewPurpose } from "@/features/analysis/review-frames";
import { limitAnalysisSentences, normalizeAnalysisText } from "@/features/analysis/sentences";
import type { AnalysisResult, AnatomyRegion } from "@/features/analysis/result-schema";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

type ResultsScreenProps = {
  result: AnalysisResult;
  videoUrl?: string | null;
  durationMs?: number | null;
  playbackWindow?: PlaybackWindow | null;
  onRecordAnother: () => void;
  onAskCoach?: () => void;
  onReanalyze?: () => void;
  reanalyzing?: boolean;
  reanalysisError?: string | null;
  exampleState?: "loading" | "ready" | "error";
  onWatchExample?: () => void;
};

const summaryTextStyle = { fontSize: 16, lineHeight: 23, fontWeight: "400" as const };
const summaryListTextStyle = { fontSize: 16, lineHeight: 23, fontWeight: "600" as const };
export function conciseCopy(value: string, maxSentences: number, maxWords: number): string {
  const selected = limitAnalysisSentences(value, maxSentences);
  const words = selected.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return selected;
  return `${words.slice(0, maxWords).join(" ").replace(/[.!?]+$/, "")}…`;
}

export function plainCoachingText(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*(?:[-+*]|\d+[.)])\s+/gm, "")
    .replace(/[*_`~#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitOpeningSentence(value: string): { opening: string; supporting: string } {
  const match = value.trim().match(/^(.+?[.!?])(?:\s+|$)([\s\S]*)$/);
  return match
    ? { opening: match[1].trim(), supporting: match[2].trim() }
    : { opening: value.trim(), supporting: "" };
}

function SummaryList({ title, items, testPrefix }: { title: string; items: { id: string; text: string }[]; testPrefix: string }) {
  if (items.length === 0) return null;
  const treatment = title === "WHAT YOU DID WELL"
    ? { icon: "✓", accent: colors.success, background: "rgba(53,208,127,0.10)" }
    : title === "FOCUS AREAS"
      ? { icon: "!", accent: colors.danger, background: "rgba(240,90,90,0.08)" }
      : { icon: "→", accent: colors.gold, background: colors.goldSoft };
  return (
    <View style={{ gap: spacing.sm }}>
      <Text selectable style={[typography.label, { color: colors.text }]}>{title}</Text>
      {items.map((item) => (
        <View key={item.id} testID={`${testPrefix}-${item.id}-card`} style={{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md, borderWidth: 1, borderColor: treatment.accent, backgroundColor: treatment.background }}>
          <View style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: treatment.accent }}>
            <Text style={{ color: colors.background, fontSize: 16, fontWeight: "900" }}>{treatment.icon}</Text>
          </View>
          <Text selectable testID={`${testPrefix}-${item.id}`} style={[summaryListTextStyle, { flex: 1, color: title === "WHAT YOU DID WELL" ? colors.success : colors.textSecondary }]}>{item.text}</Text>
        </View>
      ))}
    </View>
  );
}

export function formatAnalysisTimestamp(milliseconds: number): string {
  const totalTenths = Math.max(0, Math.round(milliseconds / 100));
  const minutes = Math.floor(totalTenths / 600);
  const seconds = (totalTenths % 600) / 10;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toFixed(1).padStart(4, "0")}`;
}

function declaredLoadLabel(result: AnalysisResult): string | null {
  const load = result.setDeclaration?.load;
  if (!load) return null;
  if (load.kind === "bodyweight") return "Bodyweight";
  if (load.kind === "unknown") return "Load not specified";
  return `${load.value} ${load.unit} ${{ per_hand: "per hand", total: "total", machine: "machine setting" }[load.scope]}`;
}

function declaredAmountLabel(result: AnalysisResult): string | null {
  const amount = result.setDeclaration?.amount;
  if (!amount) return result.setSummary?.totalReps ? `${result.setSummary.totalReps} reps` : null;
  return amount.kind === "seconds"
    ? `${amount.value} seconds`
    : `${amount.value} reps${amount.countScope === "per_side" ? " per side" : ""}`;
}

export function ResultsScreen({ result, videoUrl = null, durationMs = null, playbackWindow = null, onRecordAnother, onAskCoach = () => undefined, onReanalyze, reanalyzing = false, reanalysisError = null, exampleState = "loading", onWatchExample }: ResultsScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wideWorkspace = width >= 820;
  const presentation = getResultPresentation(result);
  const points = useMemo(() => buildCoachingReviewPoints(result), [result]);
  const synchronizedReviewFrames = useMemo(() => buildReviewFrames(result).observed, [result]);
  const [pointIndex, setPointIndex] = useState(0);
  const [purpose, setPurpose] = useState<ReviewPurpose>("observed");
  const movementScores = result.movementScores ?? [];
  const hasCoachScores = presentation.score !== null || movementScores.length > 0;
  const [coachView, setCoachView] = useState<"scores" | "note">(hasCoachScores ? "scores" : "note");
  const selectedIndex = Math.min(pointIndex, Math.max(0, points.length - 1));
  const point = points[selectedIndex] ?? null;
  const activeFrame = point?.[purpose] ?? null;
  const selectedVideoFrame = point?.observed ?? null;
  const hasMajorCorrection = presentation.priorityCorrections.some((finding) => finding.severity === "high");
  const declaredExercise = result.setDeclaration?.exercise.label ?? result.recognition.label ?? "";
  const exerciseMuscleFocus = useMemo(
    () => (
      result.muscleFocus.primary.length > 0
      || result.muscleFocus.secondary.length > 0
      || result.muscleFocus.unclassified.length > 0
        ? result.muscleFocus
        : resolveExerciseMuscleFocus(declaredExercise)
    ),
    [declaredExercise, result.muscleFocus],
  );
  const allIssueRegions = deriveObservedIssueRegions(presentation.priorityCorrections) as AnatomyRegion[];
  const issueRegions = point
    ? deriveObservedIssueRegions([point.observed.finding]) as AnatomyRegion[]
    : [];
  const hasMuscleFocus = exerciseMuscleFocus !== null || allIssueRegions.length > 0;
  const hasPersonalizedSummary = hasMuscleFocus || Boolean(result.coachNote);
  const wholeSetSummary = (
    hasPersonalizedSummary
      ? result.overallAssessment
      : hasMajorCorrection
        ? presentation.overallAssessment
        : result.setSummary?.verdict
  )?.trim() || presentation.overallAssessment;
  const declaredAmount = declaredAmountLabel(result);
  const declaredLoad = declaredLoadLabel(result);
  const resolvedPlaybackWindow = durationMs ? resolvePlaybackWindow(durationMs, playbackWindow) : null;
  const activeFrameTimeMs = activeFrame && resolvedPlaybackWindow
    ? sourceToClipMs(activeFrame.timeMs, resolvedPlaybackWindow)
    : activeFrame?.timeMs ?? 0;
  const nextSetActions = presentation.priorityCorrections.map((finding, index) => {
    const persisted = result.nextSetPlan?.find((item) => item.relatedFindingId === finding.id);
    return persisted ?? {
      id: `derived-${finding.id}`,
      action: finding.expandedCoaching?.whatToDo
        ?? finding.actionableCorrection?.instruction
        ?? finding.correction
        ?? finding.cue
        ?? finding.title,
      relatedFindingId: finding.id,
      priority: index + 1,
    };
  });
  const summaryStrengths = presentation.didWell.slice(0, 3).map((finding) => ({ id: finding.id, text: finding.title }));
  const summaryFocusAreas = presentation.priorityCorrections.map((finding) => ({ id: finding.id, text: finding.title }));
  const summaryNextActions = nextSetActions.slice(0, 3).map((item) => ({ id: item.id, text: item.action }));
  const coachNote = result.coachNote?.trim() || null;
  const conciseWholeSetSummary = wholeSetSummary ? conciseCopy(wholeSetSummary, 4, 85) : null;
  const movePoint = (direction: -1 | 1) => {
    if (points.length === 0) return;
    setPointIndex((selectedIndex + direction + points.length) % points.length);
    setPurpose("observed");
  };
  const selectReviewFrame = (frame: ReviewFrame) => {
    const index = points.findIndex((item) => item.observed.id === frame.id || item.observed.findingId === frame.findingId);
    if (index >= 0) {
      setPointIndex(index);
      setPurpose("observed");
    }
  };

  const activeCoachingCopy = point
    ? purpose === "observed"
      ? normalizeAnalysisText([point.observed.body, point.observed.detail].filter(Boolean).join(" "))
      : purpose === "why"
        ? normalizeAnalysisText([point.why.body ?? point.observed.finding.whyItMatters, point.why.detail].filter(Boolean).join(" "))
        : normalizeAnalysisText([point.next.title, point.next.body].filter(Boolean).join(" "))
    : "";
  const { opening: activeCoachingOpening, supporting: activeCoachingSupporting } = splitOpeningSentence(plainCoachingText(activeCoachingCopy));
  const activeCoachingTestId = purpose === "observed" ? "coaching-what-happened" : purpose === "why" ? "coaching-why-it-matters" : "coaching-what-to-do-next";

  if (presentation.status === "unable") {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, gap: spacing.xl, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl, paddingHorizontal: spacing.lg }} style={{ flex: 1, backgroundColor: colors.background }}>
        <Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 1.8 }]}>RECORDING UNUSABLE</Text>
        <View style={{ gap: spacing.lg, padding: spacing.xl, borderRadius: radii.lg, borderCurve: "continuous", borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.surface }}>
          <Text selectable style={[typography.heading, { color: colors.text }]}>{presentation.retryReason ?? "The movement could not be reviewed."}</Text>
          <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{presentation.retryInstruction ?? "Record the movement again."}</Text>
          <FormButton label="Record Again" onPress={onRecordAnother} />
        </View>
      </ScrollView>
    );
  }

  const selectorCoachingPanel = point && activeFrame ? (
    <View testID="coaching-panel" style={{ width: wideWorkspace ? undefined : "100%", minWidth: 0, flex: wideWorkspace ? 1 : undefined, gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <Pressable accessibilityLabel="Previous problem" accessibilityRole="button" onPress={() => movePoint(-1)} style={({ pressed }) => ({ width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.goldSoft : colors.surface })}><Text style={{ color: colors.text, fontSize: 26 }}>‹</Text></Pressable>
        <View style={{ flex: 1, minWidth: 0, minHeight: 64, justifyContent: "center", gap: spacing.xs }}>
          <Text selectable style={[typography.label, { color: colors.gold }]}>{point.observed.finding.coachingType === "optimization" ? "Optimization" : point.kind === "issue" ? "Issue" : "Advice"} {selectedIndex + 1} of {points.length}</Text>
          <Text selectable style={[typography.heading, { color: colors.text, flexShrink: 1 }]}>{point.observed.finding.title}</Text>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>{point.observed.evidence.phase ?? "Visible moment"} · {formatAnalysisTimestamp(activeFrameTimeMs)}</Text>
        </View>
        <Pressable accessibilityLabel="Next problem" accessibilityRole="button" onPress={() => movePoint(1)} style={({ pressed }) => ({ width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.goldSoft : colors.surface })}><Text style={{ color: colors.text, fontSize: 26 }}>›</Text></Pressable>
      </View>
      <View accessibilityLabel={`Coaching for ${point.observed.finding.title}`} style={{ width: "100%", overflow: "hidden", borderRadius: radii.lg, borderCurve: "continuous", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }} testID="active-coaching-panel">
        <View accessibilityRole="tablist" style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border }}>
          {([
            ["observed", "What happened"],
            ["why", "Why it matters"],
            ["next", "What to do next"],
          ] as [ReviewPurpose, string][]).map(([value, label]) => (
            <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: purpose === value }} accessibilityLabel={label} onPress={() => setPurpose(value)} style={{ flex: 1, minHeight: 54, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xs, borderBottomWidth: 2, borderBottomColor: purpose === value ? colors.gold : "transparent" }}>
              <Text style={[typography.caption, { color: purpose === value ? colors.gold : colors.textMuted, textAlign: "center" }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ width: "100%", minWidth: 0, gap: spacing.xs, padding: spacing.lg }}>
          <Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 1.2 }]}>{purpose === "observed" ? "WHAT HAPPENED" : purpose === "why" ? "WHY IT MATTERS" : "WHAT TO DO NEXT"}</Text>
          <Text
            selectable
            testID={`${activeCoachingTestId}${purpose === "next" ? "" : "-copy"}`}
            style={{ color: colors.text, fontSize: 15, lineHeight: 22, fontWeight: "700" }}
          >
            {plainCoachingText(activeCoachingOpening)}
          </Text>
          {activeCoachingSupporting ? <Text
            selectable
            testID={`${activeCoachingTestId}-detail`}
            style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 22, fontWeight: "400" }}
          >
            {plainCoachingText(activeCoachingSupporting)}
          </Text> : null}
        </View>
      </View>
    </View>
  ) : (
    <View style={{ gap: spacing.xs, padding: spacing.lg, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      <Text selectable style={[typography.heading, { color: colors.text }]}>No visible issues found</Text>
      <Text selectable style={[typography.body, { color: colors.textSecondary }]}>The set did not support a correction. Strengths are shown separately below.</Text>
    </View>
  );

  return (
    <ScrollView alwaysBounceVertical bounces overScrollMode="auto" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: spacing.xl, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl, paddingHorizontal: spacing.lg }} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ gap: spacing.md }}>
        <Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 1.8 }]}>COACHING REVIEW</Text>
      </View>

      <View testID="coaching-workspace" style={{ flexDirection: wideWorkspace ? "row" : "column", alignItems: "flex-start", gap: spacing.lg }}>
        {videoUrl && durationMs ? (
          <View style={{ width: wideWorkspace ? "48%" : "100%", maxWidth: wideWorkspace ? 560 : undefined }}>
            <FullRecording videoUrl={videoUrl} durationMs={durationMs} playbackWindow={playbackWindow} reviewFrames={synchronizedReviewFrames} selectedReviewFrame={selectedVideoFrame} onSelectReviewFrame={selectReviewFrame} showActiveFrameCard={false} />
          </View>
        ) : null}
        {selectorCoachingPanel}
      </View>

      {hasMuscleFocus ? <View testID="muscle-focus-section" style={{ gap: spacing.md }}>
        <Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 1.4 }]}>EXERCISE MUSCLE FOCUS</Text>
        <MuscleFocusFigure focus={exerciseMuscleFocus} issueRegions={issueRegions} />
      </View> : null}

      {(coachNote || hasCoachScores) ? <View testID="coach-note-scores-section" style={{ width: "100%", gap: spacing.md, padding: spacing.lg, borderRadius: radii.md, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.goldSoft }}>
        <Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 1.4 }]}>COACH&apos;S NOTE</Text>
        <View accessibilityRole="tablist" style={{ flexDirection: "row", padding: 3, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>
          {([
            ["scores", "Scores", hasCoachScores],
            ["note", "Coach's Note", Boolean(coachNote)],
          ] as const).filter(([, , available]) => available).map(([value, label]) => {
            const selected = coachView === value;
            return (
              <Pressable key={value} accessibilityLabel={label} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setCoachView(value)} style={{ flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, backgroundColor: selected ? colors.gold : "transparent" }}>
                <Text style={[typography.label, { color: selected ? colors.background : colors.textSecondary }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        {coachView === "scores" && hasCoachScores ? <View style={{ width: "100%", gap: spacing.md }}>
          <Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 1.4 }]}>SCORES</Text>
          {presentation.score !== null ? <View style={{ width: "100%", gap: spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.sm }}>
              <Text selectable style={[typography.label, { color: colors.text }]}>Overall Form</Text>
              <Text accessibilityLabel={`Coach score ${presentation.score} out of 100`} selectable style={[typography.heading, { color: colors.gold, fontVariant: ["tabular-nums"] }]}>{presentation.score}</Text>
            </View>
            <View testID="coach-score-gauge" accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: presentation.score }} style={{ height: 18, justifyContent: "center" }}>
              <View style={{ height: 5, borderRadius: 3, backgroundColor: colors.border }}>
                <View style={{ width: `${presentation.score}%`, height: 5, borderRadius: 3, backgroundColor: colors.gold }} />
                <View style={{ position: "absolute", left: `${presentation.score}%`, top: -6, width: 17, height: 17, marginLeft: -8.5, borderRadius: 9, borderWidth: 3, borderColor: colors.goldSoft, backgroundColor: colors.gold }} />
              </View>
            </View>
          </View> : null}
          {movementScores.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} testID="movement-scores" contentContainerStyle={{ gap: spacing.sm }}>
            {movementScores.map((item) => (
              <View key={item.id} style={{ width: Math.min(230, width - spacing.xl * 2), gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.sm }}>
                  <Text selectable style={[typography.label, { flex: 1, color: colors.text }]}>{item.label}</Text>
                  <Text selectable style={[typography.label, { color: colors.gold, fontVariant: ["tabular-nums"] }]}>{Math.round(item.score)}</Text>
                </View>
                <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(item.score) }} style={{ height: 5, borderRadius: 3, overflow: "hidden", backgroundColor: colors.border }}>
                  <View style={{ width: `${Math.max(0, Math.min(100, item.score))}%`, height: 5, backgroundColor: colors.gold }} />
                </View>
                <Text selectable style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>{item.observed}</Text>
              </View>
            ))}
          </ScrollView> : null}
        </View> : null}
        {coachView === "note" && coachNote ? <Text selectable style={{ color: colors.text, fontSize: 16, lineHeight: 23 }}>{coachNote}</Text> : null}
      </View> : null}

      {conciseWholeSetSummary ? <View testID="whole-set-summary-section" style={{ gap: spacing.md, padding: spacing.lg, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
        <Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 1.4 }]}>WHOLE SET SUMMARY</Text>
        {(declaredExercise || declaredAmount || declaredLoad) ? <Text selectable style={[typography.label, { color: colors.textSecondary }]}>{[declaredExercise, declaredAmount, declaredLoad].filter(Boolean).join(" · ")}</Text> : null}
        <Text selectable testID="whole-set-summary-text" style={[summaryTextStyle, { color: colors.text }]}>{conciseWholeSetSummary}</Text>
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <SummaryList title="WHAT YOU DID WELL" items={summaryStrengths} testPrefix="summary-strength" />
        <SummaryList title="FOCUS AREAS" items={summaryFocusAreas} testPrefix="summary-focus" />
        <SummaryList title="YOUR NEXT SET" items={summaryNextActions} testPrefix="summary-next" />
      </View> : null}

      {presentation.comparison ? <View style={{ gap: spacing.sm, padding: spacing.lg, borderRadius: radii.md, borderWidth: 1, borderColor: colors.gold }}><Text selectable style={[typography.caption, { color: colors.gold }]}>SINCE YOUR LAST SET</Text><Text selectable style={[typography.body, { color: colors.text }]}>{presentation.comparison.summary}</Text></View> : null}

      <View testID="result-actions" style={{ flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
        <Pressable accessibilityRole="button" onPress={onAskCoach} style={{ flex: 1, minHeight: 72, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md }}><Text style={[typography.body, { color: colors.text, textAlign: "center" }]}>Ask Formie Coach</Text></Pressable>
        <View style={{ width: 1, backgroundColor: colors.border }} />
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: exampleState === "loading" }} disabled={exampleState === "loading"} onPress={onWatchExample} style={{ flex: 1, minHeight: 72, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md }}>
          <Text style={[typography.body, { color: exampleState === "error" ? colors.textMuted : colors.gold, textAlign: "center" }]}>{exampleState === "loading" ? "Loading Example…" : exampleState === "error" ? "Retry Example" : "Watch Example"}</Text>
        </Pressable>
      </View>

      {videoUrl && onReanalyze ? <View style={{ gap: spacing.sm, alignItems: "center" }}>
        <Text selectable style={[typography.body, { color: colors.textSecondary, textAlign: "center" }]}>Something look wrong?</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: reanalyzing }} disabled={reanalyzing} onPress={onReanalyze} testID="reanalyze-video" style={({ pressed }) => ({ minHeight: 56, alignSelf: "stretch", alignItems: "center", justifyContent: "center", borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.surfaceRaised : colors.surface, opacity: reanalyzing ? 0.6 : 1 })}><Text selectable style={[typography.label, { color: colors.gold }]}>{reanalyzing ? "Analyzing Again…" : "Analyze Again"}</Text></Pressable>
        {reanalysisError ? <Text accessibilityRole="alert" selectable style={[typography.caption, { color: colors.danger, textAlign: "center" }]}>{reanalysisError}</Text> : null}
      </View> : null}

      <Pressable accessibilityRole="button" onPress={onRecordAnother} testID="record-another-loop" style={({ pressed }) => ({ minHeight: 72, alignItems: "center", justifyContent: "center", borderRadius: radii.md, backgroundColor: pressed ? colors.goldPressed : colors.gold })}><Text selectable style={[typography.heading, { color: colors.background }]}>Record Another Set</Text></Pressable>
    </ScrollView>
  );
}
