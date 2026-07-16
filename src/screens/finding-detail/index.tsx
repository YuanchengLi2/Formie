import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EvidenceVideo } from "@/components/evidence-video";
import { FormButton } from "@/components/form-button";
import { FormCard } from "@/components/form-card";
import type { CoachingFinding } from "@/features/analysis/result-schema";
import { formatPointAdvice } from "@/features/analysis/evidence-timestamp";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

function timestamp(milliseconds: number): string {
  const totalSeconds = milliseconds / 1_000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(1).padStart(4, "0");
  return `${minutes.toString().padStart(2, "0")}:${seconds}`;
}

type FindingDetailScreenProps = {
  finding: CoachingFinding;
  videoUrl: string | null;
  onRecordAnother: () => void;
};

export function FindingDetailScreen({ finding, videoUrl, onRecordAnother }: FindingDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const [activeEvidenceIndex, setActiveEvidenceIndex] = useState(0);
  const evidence = finding.evidence[Math.min(activeEvidenceIndex, finding.evidence.length - 1)];
  const context = [evidence.repNumber ? `Rep ${evidence.repNumber}` : "Between reps", evidence.phase, `${timestamp(evidence.startMs)}–${timestamp(evidence.endMs)}`].filter(Boolean).join(" · ");

  return (
    <ScrollView alwaysBounceVertical bounces overScrollMode="auto" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: spacing.lg, paddingTop: spacing.lg, paddingBottom: insets.bottom + spacing.xl, paddingHorizontal: spacing.lg }} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ gap: spacing.xs }}>
        <Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 0.8 }]}>COACHING DETAIL</Text>
        <Text selectable style={[typography.title, { color: colors.text }]}>{finding.title}</Text>
        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>{context}</Text>
      </View>

      {finding.evidence.length > 1 ? (
        <View accessibilityLabel="Evidence moment selector" style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {finding.evidence.map((moment, index) => (
            <Pressable accessibilityLabel={`Show evidence ${index + 1}`} accessibilityRole="button" key={`${moment.startMs}-${index}`} onPress={() => setActiveEvidenceIndex(index)} style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 999, borderWidth: 1, borderColor: index === activeEvidenceIndex ? colors.gold : colors.border, backgroundColor: index === activeEvidenceIndex ? colors.goldSoft : colors.surface }}>
              <Text selectable style={[typography.caption, { color: index === activeEvidenceIndex ? colors.gold : colors.textSecondary }]}>{moment.repNumber ? `Rep ${moment.repNumber} · ` : "Between · "}{timestamp(moment.peakMs ?? moment.startMs)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {videoUrl ? <EvidenceVideo key={`${finding.id}-${activeEvidenceIndex}`} videoUrl={videoUrl} evidence={evidence} /> : <View style={{ height: 180, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}><Text selectable style={[typography.caption, { color: colors.textMuted }]}>Loading private video evidence…</Text></View>}

      <View style={{ gap: spacing.sm }}>
        <Text selectable style={[typography.caption, { color: colors.gold }]}>WHAT HAPPENED</Text>
        <Text selectable style={[typography.body, { color: colors.text }]}>{formatPointAdvice(evidence)}</Text>
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{finding.detail}</Text>
        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>{evidence.visualEvidence}</Text>
      </View>

      {finding.cue ? <FormCard style={{ borderColor: colors.gold, backgroundColor: colors.surfaceRaised }}><Text selectable style={[typography.caption, { color: colors.gold }]}>TRY THIS</Text><Text selectable style={[typography.heading, { color: colors.text }]}>{finding.cue}</Text></FormCard> : null}
      <FormCard><Text selectable style={[typography.caption, { color: colors.gold }]}>WHY IT MATTERS</Text><Text selectable style={[typography.body, { color: colors.textSecondary }]}>{finding.whyItMatters}</Text></FormCard>
      {finding.correction ? <FormCard><Text selectable style={[typography.caption, { color: colors.gold }]}>WHAT TO CHANGE</Text><Text selectable style={[typography.body, { color: colors.textSecondary }]}>{finding.correction}</Text></FormCard> : null}
      <FormButton label="Record Another Set" onPress={onRecordAnother} />
    </ScrollView>
  );
}
