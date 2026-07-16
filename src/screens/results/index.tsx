import { useMemo, useState } from "react";
import { Image } from "expo-image";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ExerciseFamilyIcon } from "@/components/exercise-family-icon";
import { FormCard } from "@/components/form-card";
import { FormWordmark } from "@/components/form-wordmark";
import { FullRecording } from "@/components/full-recording";
import { ScoreRing } from "@/components/score-ring";
import type { PoseTracking, TutorialVideo } from "@/features/analysis/api";
import { getResultPresentation } from "@/features/analysis/presentation";
import type { AnalysisResult, CoachingFinding, PrecisionReview } from "@/features/analysis/result-schema";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

type ResultsScreenProps = {
  result: AnalysisResult;
  videoUrl?: string | null;
  durationMs?: number | null;
  poseTracking?: PoseTracking | null;
  onFindingPress: (finding: CoachingFinding) => void;
  onRecordAnother: () => void;
  tutorial?: TutorialVideo | null;
  tutorialLoading?: boolean;
  onOpenTutorial?: (tutorial: TutorialVideo) => void;
};

function findingById(result: AnalysisResult, id: string | null): CoachingFinding | null {
  if (!id) return null;
  return [...result.priorityCorrections, ...result.didWell, ...result.coachingCues].find((finding) => finding.id === id) ?? null;
}

function FindingRow({ finding, onPress, checked = false }: { finding: CoachingFinding; onPress: () => void; checked?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ gap: spacing.xs, paddingVertical: spacing.md, borderBottomWidth: 1, borderColor: colors.border, opacity: pressed ? 0.65 : 1 })}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <View style={{ width: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: 11, borderWidth: 1, borderColor: colors.gold }}><Text style={{ color: colors.gold, fontSize: 12 }}>✓</Text></View>
        <Text selectable style={[typography.label, { flex: 1, color: colors.text }]}>{finding.title}</Text>
        <Text style={{ color: colors.gold, fontSize: 20 }}>›</Text>
      </View>
      <Text selectable numberOfLines={2} style={[typography.caption, { paddingLeft: 30, color: colors.textSecondary }]}>{finding.detail}</Text>
      {checked ? <Text selectable style={[typography.caption, { paddingLeft: 30, color: colors.gold }]}>Evidence checked</Text> : null}
    </Pressable>
  );
}

function PremiumReviewReceipt({ review }: { review: PrecisionReview }) {
  const completed = review.passes.filter((pass) => pass.outcome !== "failed").length;
  const failed = review.status === "failed" || review.status === "partial";
  const detail = review.status === "completed"
    ? `${review.runsUsed} additional evidence ${review.runsUsed === 1 ? "run" : "runs"} completed`
    : review.status === "not-needed"
      ? "No additional evidence runs needed"
      : `${review.runsUsed} attempted · ${completed} completed`;
  const status = review.status === "failed"
    ? "Stopped after review failure"
    : review.status === "partial"
      ? "Stopped after a partial review"
      : null;

  return (
    <FormCard style={{ gap: spacing.sm, borderColor: failed ? colors.danger : colors.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, borderWidth: 1, borderColor: failed ? colors.danger : colors.gold }}>
          <Text selectable style={[typography.label, { color: failed ? colors.danger : colors.gold, fontVariant: ["tabular-nums"] }]}>{review.runsUsed}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text selectable style={[typography.label, { color: colors.text }]}>Premium precision review</Text>
          <Text selectable style={[typography.caption, { color: colors.textSecondary }]}>{detail}</Text>
          {status ? <Text selectable style={[typography.caption, { color: colors.danger }]}>{status}</Text> : null}
        </View>
      </View>
      {review.passes.map((pass) => {
        const tokens = pass.usage.promptTokens + pass.usage.outputTokens + pass.usage.thinkingTokens;
        return (
          <View key={pass.passNumber} style={{ flexDirection: "row", gap: spacing.sm, paddingTop: spacing.xs, borderTopWidth: 1, borderColor: colors.border }}>
            <Text selectable style={[typography.caption, { color: colors.gold }]}>RUN {pass.passNumber}</Text>
            <Text selectable style={[typography.caption, { flex: 1, color: colors.textSecondary }]}>{pass.kind} · {pass.outcome}</Text>
            <Text selectable style={[typography.caption, { color: colors.textMuted }]}>{tokens > 0 ? `${tokens} tokens` : "usage unavailable"}</Text>
          </View>
        );
      })}
    </FormCard>
  );
}

export function formatAnalysisTimestamp(milliseconds: number): string {
  const totalTenths = Math.max(0, Math.round(milliseconds / 100));
  const minutes = Math.floor(totalTenths / 600);
  const seconds = (totalTenths % 600) / 10;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toFixed(1).padStart(4, "0")}`;
}

export function ResultsScreen({ result, videoUrl = null, durationMs = null, poseTracking = null, onFindingPress, onRecordAnother, tutorial = null, tutorialLoading = false, onOpenTutorial = () => undefined }: ResultsScreenProps) {
  const insets = useSafeAreaInsets();
  const [showScope, setShowScope] = useState(false);
  const presentation = getResultPresentation(result);
  const priority = presentation.priorityCorrections[0] ?? null;
  const repTimeline = result.repTimeline ?? [];
  const nextSetPlan = result.nextSetPlan ?? [];
  const scope = useMemo(() => [
    ...result.videoCheck.usableObservations,
    ...result.videoCheck.limitations.map((item) => `Limited: ${item}`),
  ].filter((item) => !/camera|angle|framing|viewpoint|orientation|device position/i.test(item)), [result.videoCheck.limitations, result.videoCheck.usableObservations]);
  const consistency = result.setSummary?.totalReps && result.setSummary.consistentReps !== null
    ? `${result.setSummary.consistentReps} of ${result.setSummary.totalReps} reps consistent`
    : null;

  return (
    <ScrollView alwaysBounceVertical bounces overScrollMode="auto" contentContainerStyle={{ gap: spacing.lg, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl, paddingHorizontal: spacing.lg }} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ alignItems: "center" }}><FormWordmark /></View>

      <View style={{ gap: spacing.sm }}>
        <Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 1.8 }]}>{presentation.status === "unable" ? "RECORDING UNUSABLE" : "ANALYSIS COMPLETE"}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <ExerciseFamilyIcon family={result.recognition.exerciseFamily} size={64} />
          <Text selectable style={[typography.title, { flex: 1, color: colors.text }]}>{presentation.exerciseLabel}</Text>
          {presentation.score !== null ? <ScoreRing score={presentation.score} size={76} /> : null}
        </View>
      </View>

      {presentation.status === "unable" ? (
        <FormCard style={{ gap: spacing.sm, borderColor: colors.gold }}>
          <Text selectable style={[typography.heading, { color: colors.text }]}>{presentation.retryReason ?? "The movement could not be reviewed."}</Text>
          <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{presentation.retryInstruction ?? "Record the movement again."}</Text>
        </FormCard>
      ) : (
        <>
          <FormCard style={{ gap: spacing.sm, backgroundColor: colors.surfaceRaised }}>
            <Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 1.2 }]}>COACH’S VERDICT</Text>
            <Text selectable style={[typography.heading, { color: colors.text }]}>{result.setSummary?.verdict ?? presentation.overallAssessment}</Text>
            {consistency ? <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{consistency}</Text> : null}
          </FormCard>

          {result.precisionReview ? <PremiumReviewReceipt review={result.precisionReview} /> : null}

          {poseTracking ? <FormCard style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}><View style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, borderWidth: 1, borderColor: colors.gold }}><Text selectable style={[typography.label, { color: colors.gold }]}>2D</Text></View><View style={{ flex: 1, gap: 2 }}><Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 0.8 }]}>Movement tracking</Text><Text selectable style={[typography.label, { color: colors.text }]}>MoveNet Thunder</Text><Text selectable style={[typography.caption, { color: colors.textSecondary }]}>{poseTracking.framesAnalyzed} frames analyzed at {poseTracking.sampleFps} fps</Text></View></FormCard> : null}

          {videoUrl && durationMs ? <View style={{ gap: spacing.sm }}><Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 1.2 }]}>FULL RECORDING</Text><FullRecording videoUrl={videoUrl} reps={repTimeline} durationMs={durationMs} /></View> : null}

          <View style={{ gap: spacing.sm }}>
            <Text selectable style={[typography.heading, { color: colors.text }]}>COACH’S REVIEW</Text>
            {priority ? (
              <Pressable accessibilityRole="button" onPress={() => onFindingPress(priority)} style={({ pressed }) => ({ overflow: "hidden", gap: spacing.sm, padding: spacing.lg, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised, opacity: pressed ? 0.7 : 1 })}>
                <Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 1.2 }]}>BIGGEST IMPROVEMENT</Text>
                <Text selectable style={[typography.heading, { color: colors.text }]}>{priority.correction ?? priority.title}</Text>
                <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{priority.detail}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text selectable style={[typography.caption, { color: colors.textMuted }]}>{priority.evidence.map((item) => `${item.repNumber ? `Rep ${item.repNumber} · ` : ""}${formatAnalysisTimestamp(item.peakMs ?? item.startMs)}`).join(", ")}</Text>
                  <Text selectable style={[typography.label, { color: colors.gold }]}>See full explanation  ›</Text>
                </View>
                {result.verification?.performed && ["confirmed", "revised"].includes(result.verification.outcome) && result.verification.checkedFindingId === priority.id ? <Text selectable style={[typography.caption, { color: colors.gold }]}>Evidence checked</Text> : null}
              </Pressable>
            ) : null}
          </View>

          {presentation.didWell.length > 0 ? (
            <FormCard style={{ gap: 0 }}>
              <Text selectable style={[typography.heading, { paddingBottom: spacing.sm, color: colors.text }]}>WHAT WORKED</Text>
              {presentation.didWell.map((finding) => <FindingRow key={finding.id} finding={finding} onPress={() => onFindingPress(finding)} />)}
            </FormCard>
          ) : null}

          {nextSetPlan.length > 0 ? (
            <FormCard style={{ gap: 0, backgroundColor: colors.surfaceRaised }}>
              <Text selectable style={[typography.caption, { paddingBottom: spacing.sm, color: colors.gold, letterSpacing: 1.2 }]}>NEXT SET PLAN</Text>
              {nextSetPlan.map((item, index) => {
                const related = findingById(result, item.relatedFindingId);
                return (
                  <Pressable accessibilityRole={related ? "button" : undefined} key={item.id} onPress={related ? () => onFindingPress(related) : undefined} style={({ pressed }) => ({ minHeight: 54, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: index < nextSetPlan.length - 1 ? 1 : 0, borderColor: colors.border, opacity: pressed ? 0.65 : 1 })}>
                    <Text selectable style={[typography.heading, { width: 24, color: colors.gold }]}>{index + 1}</Text>
                    <View style={{ flex: 1, gap: 2 }}><Text selectable style={[typography.label, { color: colors.text }]}>{item.action}</Text><Text selectable numberOfLines={1} style={[typography.caption, { color: colors.textMuted }]}>{item.rationale}</Text></View>
                    {related ? <Text style={{ color: colors.gold, fontSize: 20 }}>›</Text> : null}
                  </Pressable>
                );
              })}
              {presentation.coachingCues[0]?.cue ? <View style={{ gap: spacing.xs, paddingTop: spacing.md }}><Text selectable style={[typography.caption, { color: colors.gold }]}>REMEMBER</Text><Text selectable style={[typography.heading, { color: colors.text }]}>“{presentation.coachingCues[0].cue}”</Text></View> : null}
            </FormCard>
          ) : null}

          {priority ? (
            <Pressable accessibilityRole="button" onPress={() => onFindingPress(priority)} style={({ pressed }) => ({ minHeight: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.65 : 1 })}><Text selectable style={[typography.body, { flex: 1, color: colors.text }]}>Why {priority.title.toLocaleLowerCase()} matters</Text><Text style={{ color: colors.gold, fontSize: 22 }}>›</Text></Pressable>
          ) : null}
          {scope.length > 0 ? (
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: showScope }} onPress={() => setShowScope((value) => !value)} style={({ pressed }) => ({ gap: spacing.sm, padding: spacing.lg, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.65 : 1 })}>
              <View style={{ flexDirection: "row", alignItems: "center" }}><Text selectable style={[typography.body, { flex: 1, color: colors.text }]}>What FORM could evaluate</Text><Text style={{ color: colors.gold, fontSize: 22 }}>{showScope ? "⌄" : "›"}</Text></View>
              {showScope ? scope.map((item) => <Text selectable key={item} style={[typography.caption, { color: colors.textSecondary }]}>• {item}</Text>) : null}
            </Pressable>
          ) : null}

          {presentation.comparison ? <FormCard style={{ gap: spacing.sm, borderColor: colors.gold }}><Text selectable style={[typography.caption, { color: colors.gold }]}>SINCE YOUR LAST SET</Text><Text selectable style={[typography.heading, { color: colors.text }]}>{presentation.comparison.priorityIssueImproved ? "Your correction worked" : "Keep working the same correction"}</Text><Text selectable style={[typography.body, { color: colors.textSecondary }]}>{presentation.comparison.summary}</Text></FormCard> : null}

          {tutorial ? (
            <Pressable accessibilityRole="link" accessibilityLabel={`Watch ${tutorial.title} on YouTube`} onPress={() => onOpenTutorial(tutorial)} style={({ pressed }) => ({ overflow: "hidden", borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised, opacity: pressed ? 0.75 : 1 })}>
              <View style={{ height: 150 }}><Image source={{ uri: tutorial.thumbnailUrl }} contentFit="cover" style={{ width: "100%", height: "100%" }} /><View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.18)" }}><View style={{ width: 50, height: 50, alignItems: "center", justifyContent: "center", borderRadius: 25, backgroundColor: colors.gold }}><Text style={{ color: colors.background, fontSize: 20 }}>▶</Text></View></View></View>
              <View style={{ gap: spacing.xs, padding: spacing.md }}><Text selectable style={[typography.caption, { color: colors.gold }]}>How to do this exercise properly</Text><Text selectable numberOfLines={2} style={[typography.label, { color: colors.text }]}>{tutorial.title}</Text><Text selectable style={[typography.caption, { color: colors.textSecondary }]}>{tutorial.channel} · YouTube</Text></View>
            </Pressable>
          ) : tutorialLoading ? <FormCard><Text selectable style={[typography.body, { color: colors.textSecondary }]}>Finding a clear technique video…</Text></FormCard> : null}

          <Pressable accessibilityRole="button" onPress={onRecordAnother} testID="record-another-loop" style={({ pressed }) => ({ minHeight: 92, alignItems: "center", justifyContent: "center", gap: spacing.xs, padding: spacing.lg, borderRadius: radii.md, borderCurve: "continuous", backgroundColor: pressed ? colors.goldPressed : colors.gold, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
            <Text selectable style={[typography.heading, { color: colors.background }]}>Record Another Set</Text>
            <Text selectable style={[typography.label, { color: colors.background }]}>See if your correction worked</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}
