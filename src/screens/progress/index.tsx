import { useMemo, useState } from "react";
import { Modal, ScrollView, Text, TextInput, View } from "react-native";
import { HapticPressable as Pressable } from "@/components/haptic-pressable";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

import { ResponsiveScreen } from "@/components/responsive-screen";
import { ExerciseFamilyIcon } from "@/components/exercise-family-icon";
import { FormButton } from "@/components/form-button";
import { FormWordmark } from "@/components/form-wordmark";
import type { ExerciseFamily } from "@/features/exercises/exercise-family";
import type { AnalysisHistoryGroup, AnalysisHistoryItem, AnalysisHistoryStatus } from "@/features/progress/group-sessions";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

type ExerciseRow = AnalysisHistoryItem & { family: ExerciseFamily; label: string };

type ProgressScreenProps = {
  groups: AnalysisHistoryGroup[];
  onOpenSession: (sessionId: string, status: AnalysisHistoryStatus) => void;
  onStartAnalysis?: () => void;
  onOpenProfile?: () => void;
  onTogglePin?: (sessionId: string, pinned: boolean) => void | Promise<void>;
  onDeleteSession?: (sessionId: string) => void | Promise<void>;
};

export function ProgressScreen({ groups, onOpenSession, onStartAnalysis = () => undefined, onOpenProfile = () => undefined, onTogglePin = () => undefined, onDeleteSession = () => undefined }: ProgressScreenProps) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<ExerciseFamily | "all">("all");
  const [actionRow, setActionRow] = useState<ExerciseRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const rows = useMemo<ExerciseRow[]>(() => groups.flatMap((group) => group.sessions.map((session) => ({
    ...session,
    family: group.exerciseFamily,
    label: session.status === "processing" ? "Analyzing set" : session.correctedLabel?.trim() || session.detectedLabel?.trim() || "Unusable recording",
  }))).sort((left, right) => Number(Boolean(right.pinnedAt)) - Number(Boolean(left.pinnedAt)) || right.createdAt.localeCompare(left.createdAt)), [groups]);
  const families = useMemo(() => groups.map((group) => ({ family: group.exerciseFamily, label: group.label })), [groups]);
  const filtered = rows.filter((row) => (family === "all" || row.family === family) && row.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  return (
    <ResponsiveScreen keyboardAware testID="progress-responsive-screen" contentContainerStyle={{ gap: spacing.lg, paddingTop: spacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <FormWordmark />
        <Pressable accessibilityLabel="Open settings" accessibilityRole="button" onPress={onOpenProfile} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, borderWidth: 1, borderColor: colors.gold }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: colors.gold }} />
          <View style={{ width: 15, height: 7, marginTop: 2, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 1, borderBottomWidth: 0, borderColor: colors.gold }} />
        </Pressable>
      </View>
      <View style={{ gap: spacing.xs }}>
        <Text selectable style={[typography.title, { color: colors.text }]}>Progress</Text>
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{rows.length === 0 ? "Your exercise history will appear here." : `${rows.length} saved ${rows.length === 1 ? "analysis" : "analyses"}`}</Text>
      </View>
      {rows.length === 0 ? (
        <Animated.View
          entering={FadeInDown.duration(220)}
          testID="progress-empty-state"
          style={{ flex: 1, minHeight: 390, alignItems: "center", justifyContent: "center", gap: spacing.lg, padding: spacing.xl, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
        >
          <View style={{ width: 112, height: 112, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.goldSoft }}>
            <ExerciseFamilyIcon family="other" size={82} />
          </View>
          <View style={{ alignItems: "center", gap: spacing.sm }}>
            <Text selectable style={[typography.title, { color: colors.text, textAlign: "center" }]}>Your saved analyses will live here</Text>
            <Text selectable style={[typography.body, { maxWidth: 330, color: colors.textSecondary, textAlign: "center" }]}>Start with one set. Formie will save the coaching, score, and exercise here automatically.</Text>
          </View>
          <FormButton label="Start your first analysis" onPress={onStartAnalysis} style={{ width: "100%", maxWidth: 360 }} />
        </Animated.View>
      ) : <>
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
            <Text selectable style={[typography.heading, { color: colors.text }]}>No matching exercises</Text>
            <Text selectable style={[typography.body, { color: colors.textSecondary, textAlign: "center" }]}>Try another search or filter.</Text>
          </Animated.View>
        ) : filtered.map((row) => (
          <Animated.View layout={LinearTransition.duration(180)} key={row.sessionId}>
            <View style={{ minHeight: 72, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderColor: colors.border }}>
              <Pressable accessibilityLabel={`Open analysis from ${new Date(row.createdAt).toLocaleDateString()}`} accessibilityRole="button" onLongPress={() => { setConfirmDelete(false); setActionRow(row); }} onPress={() => onOpenSession(row.sessionId, row.status)} style={({ pressed }) => ({ minHeight: 72, flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, opacity: pressed ? 0.65 : 1 })}>
                <ExerciseFamilyIcon family={row.family} size={56} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}><Text selectable numberOfLines={1} style={[typography.label, { flexShrink: 1, color: colors.text }]}>{row.label}</Text>{row.pinnedAt ? <Text accessibilityLabel="Pinned analysis" style={{ color: colors.gold, fontSize: 14 }}>◆</Text> : null}</View>
                  <Text selectable style={[typography.caption, { color: row.status === "processing" ? colors.gold : colors.textMuted }]}>{row.status === "processing" ? "Analysis in progress" : `${new Date(row.createdAt).toLocaleDateString()} · ${row.priorityCorrectionTitles[0] ?? "Analysis saved"}`}</Text>
                </View>
                <Text selectable style={[typography.heading, { color: colors.gold }]}>{row.status === "processing" ? "Continue" : row.score ?? "View"}</Text>
              </Pressable>
              <Pressable accessibilityLabel={`More options for ${row.label} from ${new Date(row.createdAt).toLocaleDateString()}`} accessibilityRole="button" onPress={() => { setConfirmDelete(false); setActionRow(row); }} style={({ pressed }) => ({ width: 48, height: 56, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.55 : 1 })}><Text style={{ color: colors.textSecondary, fontSize: 25, lineHeight: 28 }}>•••</Text></Pressable>
            </View>
          </Animated.View>
        ))}
      </View>
      </>}

      <Modal animationType="fade" onRequestClose={() => setActionRow(null)} transparent visible={Boolean(actionRow)}>
        <Pressable accessibilityLabel="Close analysis actions" onPress={() => setActionRow(null)} style={{ flex: 1, justifyContent: "flex-end", padding: spacing.lg, backgroundColor: "rgba(0,0,0,0.66)" }}>
          <Pressable onPress={(event) => event.stopPropagation()} style={{ gap: spacing.sm, padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
            <Text selectable style={[typography.heading, { color: colors.text }]}>{confirmDelete ? "Delete this analysis?" : actionRow?.label}</Text>
            {confirmDelete ? (
              <>
                <Text selectable style={[typography.body, { color: colors.textSecondary }]}>The saved coaching and private recording will be removed permanently.</Text>
                <Pressable accessibilityRole="button" onPress={() => { if (actionRow) void onDeleteSession(actionRow.sessionId); setActionRow(null); setConfirmDelete(false); }} style={{ minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: radii.md, backgroundColor: colors.danger }}><Text style={[typography.label, { color: colors.text }]}>Delete permanently</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={() => setConfirmDelete(false)} style={{ minHeight: 48, alignItems: "center", justifyContent: "center" }}><Text style={[typography.label, { color: colors.textSecondary }]}>Go back</Text></Pressable>
              </>
            ) : (
              <>
                <Pressable accessibilityRole="button" onPress={() => { if (actionRow) void onTogglePin(actionRow.sessionId, !actionRow.pinnedAt); setActionRow(null); }} style={{ minHeight: 52, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface }}><Text style={[typography.body, { color: colors.text }]}>{actionRow?.pinnedAt ? "Unpin analysis" : "Pin analysis"}</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={() => setConfirmDelete(true)} style={{ minHeight: 52, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface }}><Text style={[typography.body, { color: colors.danger }]}>Delete analysis</Text></Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ResponsiveScreen>
  );
}
