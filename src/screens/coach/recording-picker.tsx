import { useMemo, useState, type ReactNode } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { HapticPressable as Pressable } from "@/components/haptic-pressable";

import { ExerciseFamilyIcon } from "@/components/exercise-family-icon";
import type { AnalysisHistoryItem } from "@/features/progress/group-sessions";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

type Props = {
  videos: AnalysisHistoryItem[];
  creating: boolean;
  onChoose: (sessionId: string) => void;
  footer?: ReactNode;
};

export function coachRecordingLabel(video: AnalysisHistoryItem): string {
  return video.correctedLabel?.trim() || "Analyzed set";
}

export function RecordingPicker({ videos, creating, onChoose, footer }: Props) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return videos;
    return videos.filter((video) => [coachRecordingLabel(video), new Date(video.createdAt).toLocaleDateString(), ...video.priorityCorrectionTitles].some((value) => value.toLocaleLowerCase().includes(normalized)));
  }, [query, videos]);

  return (
    <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, gap: spacing.xl, padding: spacing.lg, paddingBottom: spacing.xxxl }}>
      <View style={{ gap: spacing.sm }}>
        <Text selectable style={[typography.title, { fontSize: 42, lineHeight: 48, color: colors.text }]}>Choose a set</Text>
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>Select a recording to start a conversation.</Text>
      </View>
      <TextInput accessibilityLabel="Search recordings" value={query} onChangeText={setQuery} placeholder="Search recordings" placeholderTextColor={colors.textMuted} style={[typography.body, { minHeight: 52, paddingHorizontal: spacing.lg, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceRaised }]} />
      <View style={{ gap: spacing.md }}>
        {filtered.map((video) => {
          const label = coachRecordingLabel(video);
          const summary = video.priorityCorrectionTitles[0] ?? "Open the analysis and ask about this set.";
          return (
            <Pressable key={video.sessionId} accessibilityRole="button" accessibilityLabel={`Ask Formie about ${label.toLocaleLowerCase()}`} disabled={creating} onPress={() => onChoose(video.sessionId)} style={({ pressed }) => ({ minHeight: 152, flexDirection: "row", gap: spacing.lg, padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: pressed ? colors.gold : colors.border, backgroundColor: pressed ? colors.goldSoft : colors.surface })}>
              <View testID="coach-recording-icon" style={{ width: 72, height: 72, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, backgroundColor: colors.background }}><ExerciseFamilyIcon family={video.exerciseFamily ?? "other"} size={48} /></View>
              <View style={{ flex: 1, justifyContent: "space-between", gap: spacing.sm }}>
                <View style={{ gap: spacing.xs }}>
                  <Text selectable style={[typography.heading, { color: colors.text }]}>{label}</Text>
                  <Text selectable style={[typography.caption, { color: colors.textSecondary }]}>{new Date(video.createdAt).toLocaleDateString()}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}><View style={{ minWidth: 46, padding: spacing.sm, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.gold }}><Text selectable style={[typography.heading, { color: colors.gold, textAlign: "center" }]}>{video.score ?? "—"}</Text></View><Text selectable numberOfLines={2} style={[typography.caption, { flex: 1, color: colors.textSecondary }]}>{summary}</Text></View>
                <Text selectable style={[typography.label, { color: colors.gold, textAlign: "right" }]}>{creating ? "Opening…" : "Ask Formie  ›"}</Text>
              </View>
            </Pressable>
          );
        })}
        {filtered.length === 0 ? <Text selectable style={[typography.body, { paddingVertical: spacing.xl, color: colors.textSecondary, textAlign: "center" }]}>No matching recordings</Text> : null}
      </View>
      {footer}
    </ScrollView>
  );
}
