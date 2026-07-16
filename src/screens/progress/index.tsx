import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

import { ExerciseFamilyIcon } from "@/components/exercise-family-icon";
import { FormButton } from "@/components/form-button";
import { FormWordmark } from "@/components/form-wordmark";
import type { ExerciseFamily } from "@/features/exercises/exercise-family";
import type { AnalysisHistoryGroup, AnalysisHistoryItem } from "@/features/progress/group-sessions";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

type ExerciseRow = AnalysisHistoryItem & { family: ExerciseFamily; label: string };

export function ProgressScreen({ groups, onOpenSession, onRecord }: { groups: AnalysisHistoryGroup[]; onOpenSession: (sessionId: string) => void; onRecord?: () => void }) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<ExerciseFamily | "all">("all");
  const rows = useMemo<ExerciseRow[]>(() => groups.flatMap((group) => group.sessions.map((session) => ({
    ...session,
    family: group.exerciseFamily,
    label: session.correctedLabel?.trim() || session.detectedLabel?.trim() || "Unusable recording",
  }))).sort((left, right) => right.createdAt.localeCompare(left.createdAt)), [groups]);
  const families = useMemo(() => groups.map((group) => ({ family: group.exerciseFamily, label: group.label })), [groups]);
  const filtered = rows.filter((row) => (family === "all" || row.family === family) && row.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  return (
    <ScrollView alwaysBounceVertical bounces contentInsetAdjustmentBehavior="automatic" overScrollMode="auto" style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xl }}>
      <FormWordmark />
      <View style={{ gap: spacing.xs }}>
        <Text selectable style={[typography.title, { color: colors.text }]}>Progress</Text>
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{rows.length === 0 ? "Your exercise history will appear here." : `${rows.length} saved ${rows.length === 1 ? "analysis" : "analyses"}`}</Text>
      </View>

      <TextInput
        accessibilityLabel="Search exercise history"
        autoCapitalize="none"
        onChangeText={setQuery}
        placeholder="Search exercises"
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        value={query}
        style={[typography.body, { minHeight: 48, paddingHorizontal: spacing.lg, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceRaised }]}
      />

      <ScrollView horizontal bounces={false} overScrollMode="never" showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {[{ family: "all" as const, label: "All" }, ...families].map((option) => {
          const selected = family === option.family;
          return <Pressable key={option.family} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setFamily(option.family)} style={({ pressed }) => ({ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.pill, borderWidth: 1, borderColor: selected ? colors.gold : colors.border, backgroundColor: selected ? colors.goldSoft : colors.surface, opacity: pressed ? 0.7 : 1 })}><Text selectable style={[typography.label, { color: selected ? colors.gold : colors.textSecondary }]}>{option.label}</Text></Pressable>;
        })}
      </ScrollView>

      <View style={{ gap: spacing.sm }}>
        <Text selectable style={[typography.heading, { color: colors.text }]}>Exercises</Text>
        {filtered.length === 0 ? (
          <Animated.View entering={FadeInDown.duration(220)} style={{ gap: spacing.md, paddingVertical: spacing.xl, alignItems: "center" }}>
            <Text selectable style={[typography.heading, { color: colors.text }]}>{rows.length === 0 ? "No analyses yet" : "No matching exercises"}</Text>
            <Text selectable style={[typography.body, { color: colors.textSecondary, textAlign: "center" }]}>{rows.length === 0 ? "Record a set and FORM will save it here automatically." : "Try another search or filter."}</Text>
            {rows.length === 0 && onRecord ? <FormButton style={{ width: "100%" }} label="Record an Exercise" onPress={onRecord} /> : null}
          </Animated.View>
        ) : filtered.map((row) => (
          <Animated.View layout={LinearTransition.duration(180)} key={row.sessionId}>
            <Pressable accessibilityLabel={`Open analysis from ${new Date(row.createdAt).toLocaleDateString()}`} accessibilityRole="button" onPress={() => onOpenSession(row.sessionId)} style={({ pressed }) => ({ minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: colors.border, opacity: pressed ? 0.65 : 1 })}>
              <ExerciseFamilyIcon family={row.family} size={56} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text selectable numberOfLines={1} style={[typography.label, { color: colors.text }]}>{row.label}</Text>
                <Text selectable style={[typography.caption, { color: colors.textMuted }]}>{new Date(row.createdAt).toLocaleDateString()} · {row.priorityCorrectionTitles[0] ?? "Analysis saved"}</Text>
              </View>
              <Text selectable style={[typography.heading, { color: colors.gold }]}>{row.score ?? "View"}</Text>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </ScrollView>
  );
}
