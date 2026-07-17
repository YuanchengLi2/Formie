import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FormButton } from "@/components/form-button";
import { FormCard } from "@/components/form-card";
import { FullRecording } from "@/components/full-recording";
import type { ReviewFrame } from "@/features/analysis/review-frames";
import type { AnalysisResult, CoachingFinding } from "@/features/analysis/result-schema";
import type { FindingSection } from "@/features/analysis/result-store";
import { formatPointAdvice } from "@/features/analysis/evidence-timestamp";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

function timestamp(milliseconds: number): string {
  const totalSeconds = milliseconds / 1_000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(1).padStart(4, "0");
  return `${minutes.toString().padStart(2, "0")}:${seconds}`;
}

type FindingDetailScreenProps = {
  finding: CoachingFinding;
  result?: AnalysisResult | null;
  section?: FindingSection;
  videoUrl: string | null;
  durationMs?: number | null;
  onRecordAnother: () => void;
};

const SECTION_LABEL: Record<FindingSection, string> = {
  strength: "SUPPORTED STRENGTH",
  correction: "PRIORITY CORRECTION",
  cue: "COACHING CUE",
};

export function FindingDetailScreen({ finding, result = null, section = "correction", videoUrl, durationMs = null, onRecordAnother }: FindingDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wideWorkspace = width >= 820;
  const [activeEvidenceIndex, setActiveEvidenceIndex] = useState(0);
  const evidence = finding.evidence[Math.min(activeEvidenceIndex, finding.evidence.length - 1)];
  const context = [evidence.phase, `${timestamp(evidence.startMs)}–${timestamp(evidence.endMs)}`].filter(Boolean).join(" · ");
  const reviewFrames = useMemo<ReviewFrame[]>(() => finding.evidence.map((moment, index) => ({
    id: `detail-${finding.id}-${index}-${moment.peakMs ?? moment.startMs}`,
    purpose: "observed",
    title: finding.title,
    body: formatPointAdvice(moment),
    findingId: finding.id,
    finding,
    evidence: moment,
    timeMs: moment.peakMs ?? moment.startMs,
  })), [finding]);
  const activeFrame = reviewFrames[Math.min(activeEvidenceIndex, reviewFrames.length - 1)] ?? null;
  const playbackDuration = durationMs ?? Math.max(...finding.evidence.map((moment) => moment.endMs), 1_000);
  const repNumbers = [...new Set(finding.evidence.flatMap((moment) => moment.repNumber === null ? [] : [moment.repNumber]))].sort((left, right) => left - right);
  const visibleBodyAreas = [...new Set(finding.evidence.flatMap((moment) => moment.visibleBodyAreas))];
  const patternLabel = finding.evidence.length > 1 ? "Recurring pattern" : "Single moment";
  const selectFrame = (frame: ReviewFrame) => {
    const index = reviewFrames.findIndex((item) => item.id === frame.id);
    if (index >= 0) setActiveEvidenceIndex(index);
  };

  const details = (
    <View style={{ flex: wideWorkspace ? 1 : undefined, gap: spacing.lg }}>
      {finding.evidence.length > 1 ? (
        <View style={{ gap: spacing.sm }}>
          <Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 1.2 }]}>EVIDENCE MOMENTS</Text>
          <ScrollView accessibilityLabel="Evidence moment selector" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {finding.evidence.map((moment, index) => (
              <Pressable accessibilityLabel={`Show evidence ${index + 1}`} accessibilityRole="button" key={`${moment.startMs}-${index}`} onPress={() => setActiveEvidenceIndex(index)} style={{ minHeight: 52, justifyContent: "center", paddingHorizontal: spacing.lg, borderRadius: radii.pill, borderWidth: 1, borderColor: index === activeEvidenceIndex ? colors.gold : colors.border, backgroundColor: index === activeEvidenceIndex ? colors.goldSoft : colors.surface }}>
                <Text selectable style={[typography.label, { color: index === activeEvidenceIndex ? colors.gold : colors.textSecondary }]}>Moment {index + 1} · {timestamp(moment.peakMs ?? moment.startMs)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={{ gap: spacing.md, padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
        <Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 1.2 }]}>WHAT HAPPENED</Text>
        <Text selectable style={[typography.heading, { color: colors.text }]}>{formatPointAdvice(evidence)}</Text>
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{finding.detail}</Text>
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>{evidence.visualEvidence}</Text>
      </View>

      <View style={{ flexDirection: wideWorkspace ? "row" : "column", gap: spacing.md }}>
        <FormCard style={{ flex: 1, gap: spacing.sm, padding: spacing.lg }}>
          <Text selectable style={[typography.caption, { color: colors.gold }]}>PATTERN</Text>
          <Text selectable style={[typography.heading, { color: colors.text }]}>{patternLabel}</Text>
          <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{repNumbers.length ? `Reps ${repNumbers.join(", ")}` : "Setup or between repetitions"}</Text>
        </FormCard>
        <FormCard style={{ flex: 1, gap: spacing.sm, padding: spacing.lg }}>
          <Text selectable style={[typography.caption, { color: colors.gold }]}>VISIBLE EVIDENCE</Text>
          <Text selectable style={[typography.body, { color: colors.text }]}>{visibleBodyAreas.join(", ")}</Text>
        </FormCard>
      </View>

      {result?.setContext ? <FormCard style={{ gap: spacing.sm, padding: spacing.lg }}>
        <Text selectable style={[typography.caption, { color: colors.gold }]}>CAMERA CONTEXT</Text>
        <Text selectable style={[typography.heading, { color: colors.text }]}>{result.setContext.cameraView ?? "View not confidently identified"}</Text>
        {result.setContext.visibleReferences.length ? <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{result.setContext.visibleReferences.join(" • ")}</Text> : null}
      </FormCard> : null}

      {finding.cue ? <FormCard style={{ gap: spacing.md, padding: spacing.lg, borderColor: colors.gold, backgroundColor: colors.goldSoft }}><Text selectable style={[typography.caption, { color: colors.gold }]}>TRY THIS NEXT</Text><Text selectable style={[typography.heading, { color: colors.text }]}>{finding.cue}</Text></FormCard> : null}
      <View style={{ flexDirection: wideWorkspace ? "row" : "column", gap: spacing.md }}>
        <FormCard style={{ flex: 1, gap: spacing.md, padding: spacing.lg }}><Text selectable style={[typography.caption, { color: colors.gold }]}>WHY IT MATTERS</Text><Text selectable style={[typography.body, { color: colors.textSecondary }]}>{finding.whyItMatters}</Text></FormCard>
        {finding.correction ? <FormCard style={{ flex: 1, gap: spacing.md, padding: spacing.lg }}><Text selectable style={[typography.caption, { color: colors.gold }]}>WHAT TO CHANGE</Text><Text selectable style={[typography.body, { color: colors.textSecondary }]}>{finding.correction}</Text></FormCard> : null}
      </View>
    </View>
  );

  return (
    <ScrollView alwaysBounceVertical bounces overScrollMode="auto" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: spacing.xl, paddingTop: spacing.lg, paddingBottom: insets.bottom + spacing.xl, paddingHorizontal: spacing.lg }} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ gap: spacing.sm }}>
        <Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 1.2 }]}>{SECTION_LABEL[section]}</Text>
        <Text selectable style={[typography.title, { color: colors.text }]}>{finding.title}</Text>
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>{context}</Text>
      </View>

      <View testID="finding-detail-workspace" style={{ flexDirection: wideWorkspace ? "row" : "column", alignItems: "flex-start", gap: spacing.lg }}>
        {videoUrl ? <View style={{ width: wideWorkspace ? "48%" : "100%", maxWidth: wideWorkspace ? 560 : undefined }}><FullRecording videoUrl={videoUrl} durationMs={playbackDuration} reviewFrames={reviewFrames} selectedReviewFrame={activeFrame} onSelectReviewFrame={selectFrame} showActiveFrameCard={false} /></View> : <View style={{ width: wideWorkspace ? "48%" : "100%", height: 240, alignItems: "center", justifyContent: "center", borderRadius: radii.lg, backgroundColor: colors.surface }}><Text selectable style={[typography.body, { color: colors.textMuted }]}>Loading private video evidence…</Text></View>}
        {details}
      </View>

      <FormButton label="Record Another Set" onPress={onRecordAnother} />
    </ScrollView>
  );
}
