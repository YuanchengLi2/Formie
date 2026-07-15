import { Pressable, Text, View } from "react-native";

import type { CoachingFinding } from "@/features/analysis/result-schema";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

type FeedbackSectionProps = {
  title: string;
  findings: CoachingFinding[];
  onFindingPress: (finding: CoachingFinding) => void;
};

export function FeedbackSection({ title, findings, onFindingPress }: FeedbackSectionProps) {
  if (findings.length === 0) return null;

  return (
    <View style={{ gap: spacing.md }}>
      <Text selectable style={[typography.caption, { color: colors.gold }]}>{title.toUpperCase()}</Text>
      {findings.map((finding) => (
        <Pressable
          accessibilityRole="button"
          key={finding.id}
          onPress={() => onFindingPress(finding)}
          style={({ pressed }) => ({
            gap: spacing.sm,
            padding: spacing.lg,
            borderRadius: radii.md,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            opacity: pressed ? 0.76 : 1,
          })}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
            <Text selectable style={[typography.heading, { color: colors.text, flex: 1 }]}>{finding.title}</Text>
            <Text selectable style={{ color: colors.gold, fontSize: 20 }}>›</Text>
          </View>
          <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{finding.detail}</Text>
          {finding.cue ? <Text selectable style={[typography.caption, { color: colors.gold }]}>Cue: {finding.cue}</Text> : null}
        </Pressable>
      ))}
    </View>
  );
}
