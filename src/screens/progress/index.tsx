import { Image } from "expo-image";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ExerciseFamilyIcon } from "@/components/exercise-family-icon";
import { FormButton } from "@/components/form-button";
import { FormCard } from "@/components/form-card";
import { FormWordmark } from "@/components/form-wordmark";
import type { AnalysisHistoryGroup } from "@/features/progress/group-sessions";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

const emptyGraph = require("../../../assets/production/progress-empty-graph.png");

export function ProgressScreen({ groups, onOpenSession, onRecord }: { groups: AnalysisHistoryGroup[]; onOpenSession: (sessionId: string) => void; onRecord?: () => void }) {
  const totalAnalyses = groups.reduce((total, group) => total + group.sessions.length, 0);
  const allScores = groups.flatMap((group) => group.scoreTrend).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const firstScore = allScores[0]?.score;
  const lastScore = allScores.at(-1)?.score;
  const scoreDelta = firstScore !== undefined && lastScore !== undefined ? lastScore - firstScore : null;

  return <ScrollView bounces={false} overScrollMode="never" contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xl }}>
    <FormWordmark /><Text selectable style={[typography.title, { color: colors.text }]}>Progress</Text>
    <FormCard style={{ gap: spacing.md }}><Text selectable style={[typography.label, { color: colors.text }]}>Movement Quality</Text>{allScores.length === 0 ? <Image accessibilityLabel="No movement quality data yet" source={emptyGraph} contentFit="contain" style={{ width: "100%", height: 150 }} /> : <View accessibilityLabel={`Movement quality trend from ${firstScore} to ${lastScore}`} style={{ height: 122, flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingTop: spacing.md }}>{allScores.slice(-8).map((point) => <View key={`${point.sessionId}-${point.createdAt}`} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", gap: spacing.xs }}><Text selectable style={[typography.caption, { color: colors.gold }]}>{point.score}</Text><View style={{ width: "100%", minWidth: 8, height: Math.max(8, point.score * 0.72), borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: colors.gold }} /></View>)}</View>}</FormCard>

    {groups.length === 0 ? <Animated.View entering={FadeInDown.duration(220)} style={{ alignItems: "center", gap: spacing.sm }}><Text selectable style={[typography.heading, { color: colors.text }]}>Your progress starts here.</Text><Text selectable style={[typography.body, { color: colors.textSecondary, textAlign: "center" }]}>Record a set and FORM will build your movement history.</Text>{onRecord ? <FormButton style={{ width: "100%" }} label="Record an Exercise" onPress={onRecord} /> : null}</Animated.View> : <>
      <View style={{ gap: spacing.xs }}><Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 0.8 }]}>LAST 30 DAYS</Text><Text selectable style={[typography.heading, { color: colors.text }]}>{totalAnalyses} {totalAnalyses === 1 ? "analysis" : "analyses"}</Text>{scoreDelta !== null ? <Text selectable style={[typography.body, { color: scoreDelta >= 0 ? colors.gold : colors.textSecondary }]}>{scoreDelta >= 0 ? "+" : ""}{scoreDelta} average points</Text> : null}</View>
      <View style={{ gap: spacing.sm }}><Text selectable style={[typography.heading, { color: colors.text }]}>Exercises</Text>{groups.map((group) => <View key={group.key} style={{ gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: colors.border }}><Pressable accessibilityRole="button" onPress={() => onOpenSession(group.sessions[0].sessionId)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: spacing.md, opacity: pressed ? 0.7 : 1 })}><ExerciseFamilyIcon family={group.exerciseFamily} size={58} /><View style={{ flex: 1, gap: 2 }}><Text selectable style={[typography.label, { color: colors.text }]}>{group.label}</Text><Text selectable style={[typography.caption, { color: colors.textMuted }]}>{group.sessions.length} {group.sessions.length === 1 ? "analysis" : "analyses"}</Text></View><Text selectable style={[typography.heading, { color: colors.gold }]}>{group.scoreTrend.at(-1)?.score ?? "View"}</Text></Pressable>{group.recurringCorrections[0] ? <Text selectable style={[typography.caption, { color: colors.textSecondary }]}>Recurring: {group.recurringCorrections[0].title}</Text> : null}{group.improvements[0] ? <Text selectable style={[typography.caption, { color: colors.gold }]}>{group.improvements[0]}</Text> : null}<View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>{group.sessions.slice(0, 4).map((session) => <Pressable accessibilityRole="button" accessibilityLabel={`Open analysis from ${new Date(session.createdAt).toLocaleDateString()}`} key={session.sessionId} onPress={() => onOpenSession(session.sessionId)} style={({ pressed }) => ({ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.65 : 1 })}><Text selectable style={[typography.caption, { color: colors.textSecondary }]}>{new Date(session.createdAt).toLocaleDateString()} · {session.score ?? "View"}</Text></Pressable>)}</View></View>)}</View>
    </>}
  </ScrollView>;
}
