import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { FormButton } from "@/components/form-button";
import { FormCard } from "@/components/form-card";
import { FormWordmark } from "@/components/form-wordmark";
import { MovementFrame } from "@/components/movement-frame";
import type { AnalysisHistoryGroup } from "@/features/progress/group-sessions";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

type ProgressScreenProps = {
  groups: AnalysisHistoryGroup[];
  onOpenSession: (sessionId: string) => void;
  onRecord?: () => void;
};

export function ProgressScreen({ groups, onOpenSession, onRecord }: ProgressScreenProps) {
  const totalAnalyses = groups.reduce((total, group) => total + group.sessions.length, 0);
  const allScores = groups.flatMap((group) => group.scoreTrend).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const firstScore = allScores[0]?.score;
  const lastScore = allScores[allScores.length - 1]?.score;
  const scoreDelta = firstScore !== undefined && lastScore !== undefined ? lastScore - firstScore : null;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ gap: spacing.xl, padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: 112 }}>
      <FormWordmark />
      <Text selectable style={[typography.title, { color: colors.text }]}>Progress</Text>

      {groups.length === 0 ? (
        <Animated.View entering={FadeInDown.duration(220)}>
          <FormCard style={{ gap: spacing.lg, padding: spacing.xl, backgroundColor: colors.surfaceRaised }}>
            <MovementFrame height={190} />
            <Text selectable style={[typography.heading, { color: colors.text, textAlign: "center" }]}>Your progress starts here.</Text>
            <Text selectable style={[typography.body, { color: colors.textSecondary, textAlign: "center" }]}>Record a set and FORM will begin building your movement history.</Text>
            {onRecord ? <FormButton label="Record an Exercise" onPress={onRecord} /> : null}
          </FormCard>
        </Animated.View>
      ) : (
        <>
          <View style={{ gap: spacing.xs }}>
            <Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 0.8 }]}>LAST 30 DAYS</Text>
            <Text selectable style={[typography.title, { color: colors.text }]}>{totalAnalyses} {totalAnalyses === 1 ? "analysis" : "analyses"}</Text>
            {scoreDelta !== null ? <Text selectable style={[typography.body, { color: scoreDelta >= 0 ? colors.gold : colors.textSecondary }]}>{scoreDelta >= 0 ? "+" : ""}{scoreDelta} average points</Text> : null}
          </View>

          {allScores.length > 0 ? (
            <FormCard style={{ gap: spacing.md }}>
              <Text selectable style={[typography.label, { color: colors.text }]}>Movement Quality</Text>
              <View accessibilityLabel={`Movement quality trend from ${firstScore} to ${lastScore}`} style={{ height: 118, flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingTop: spacing.md }}>
                {allScores.map((point) => (
                  <View key={`${point.sessionId}-${point.createdAt}`} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", gap: spacing.xs }}>
                    <Text selectable style={[typography.caption, { color: colors.gold }]}>{point.score}</Text>
                    <View style={{ width: "100%", minWidth: 10, height: Math.max(8, point.score * 0.72), borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: colors.gold }} />
                  </View>
                ))}
              </View>
            </FormCard>
          ) : null}

          <View style={{ gap: spacing.md }}>
            <Text selectable style={[typography.heading, { color: colors.text }]}>Exercises</Text>
            {groups.map((group) => {
              const latestScore = group.scoreTrend[0]?.score ?? null;
              return (
                <FormCard key={group.key} style={{ gap: spacing.md }}>
                  <Pressable accessibilityRole="button" onPress={() => onOpenSession(group.sessions[0].sessionId)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: spacing.md, opacity: pressed ? 0.7 : 1 })}>
                    <MovementFrame height={54} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text selectable style={[typography.label, { color: colors.text }]}>{group.label}</Text>
                      <Text selectable style={[typography.caption, { color: colors.textMuted }]}>{group.sessions.length} {group.sessions.length === 1 ? "analysis" : "analyses"}</Text>
                    </View>
                    <Text selectable style={[typography.heading, { color: colors.gold }]}>{latestScore ?? "View"}</Text>
                  </Pressable>
                  {group.recurringCorrections[0] ? <Text selectable style={[typography.caption, { color: colors.textSecondary }]}>Recurring: {group.recurringCorrections[0].title}</Text> : null}
                  {group.improvements[0] ? <Text selectable style={[typography.caption, { color: colors.gold }]}>{group.improvements[0]}</Text> : null}
                  <View style={{ gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderColor: colors.border }}>
                    <Text selectable style={[typography.caption, { color: colors.textMuted }]}>Saved analyses</Text>
                    {group.sessions.map((session) => (
                      <Pressable key={session.sessionId} onPress={() => onOpenSession(session.sessionId)} style={({ pressed }) => ({ flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm, opacity: pressed ? 0.7 : 1 })}>
                        <Text selectable style={[typography.body, { color: colors.text }]}>{new Date(session.createdAt).toLocaleDateString()}</Text>
                        <Text selectable style={[typography.label, { color: colors.gold }]}>{session.score === null ? "View Analysis" : `${session.score} / 100  →`}</Text>
                      </Pressable>
                    ))}
                  </View>
                </FormCard>
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
  );
}
