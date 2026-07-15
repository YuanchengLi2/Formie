import { Pressable, ScrollView, Text, View } from "react-native";

import { FormCard } from "@/components/form-card";
import { FormWordmark } from "@/components/form-wordmark";
import type { AnalysisHistoryGroup } from "@/features/progress/group-sessions";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

type ProgressScreenProps = {
  groups: AnalysisHistoryGroup[];
  onOpenSession: (sessionId: string) => void;
};

export function ProgressScreen({ groups, onOpenSession }: ProgressScreenProps) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ gap: spacing.xl, padding: spacing.lg, paddingTop: spacing.xxl }}
    >
      <FormWordmark />
      <Text selectable style={[typography.title, { color: colors.text }]}>Progress</Text>
      <Text selectable style={[typography.body, { color: colors.textSecondary }]}>Automatically organized from your completed analyses.</Text>
      {groups.length === 0 ? (
        <FormCard>
          <Text selectable style={[typography.heading, { color: colors.text }]}>No movement history yet</Text>
          <Text selectable style={[typography.body, { color: colors.textSecondary }]}>Record a set and FORM will organize it by the exercise it detects.</Text>
        </FormCard>
      ) : groups.map((group) => {
        const latest = group.sessions[0];
        const latestScore = group.scoreTrend[0]?.score ?? null;
        return (
          <FormCard key={group.key} style={{ gap: spacing.md }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md }}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text selectable style={[typography.heading, { color: colors.text }]}>{group.label}</Text>
                <Text selectable style={[typography.caption, { color: colors.textMuted }]}>{group.sessions.length} {group.sessions.length === 1 ? "analysis" : "analyses"}</Text>
              </View>
              {latestScore !== null ? <Text selectable style={[typography.label, { color: colors.gold }]}>Movement quality {latestScore}</Text> : null}
            </View>
            {group.recurringCorrections[0] ? <Text selectable style={[typography.body, { color: colors.textSecondary }]}>Recurring: {group.recurringCorrections[0].title}</Text> : null}
            {group.improvements[0] ? <Text selectable style={[typography.body, { color: colors.gold }]}>{group.improvements[0]}</Text> : null}
            <Pressable accessibilityRole="button" onPress={() => onOpenSession(latest.sessionId)}>
              <Text selectable style={[typography.label, { color: colors.gold }]}>View Analysis</Text>
            </Pressable>
          </FormCard>
        );
      })}
    </ScrollView>
  );
}
