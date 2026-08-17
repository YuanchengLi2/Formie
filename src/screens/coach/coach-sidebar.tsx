import { useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import { HapticPressable as Pressable } from "@/components/haptic-pressable";
import Animated, { FadeIn, FadeOut, SlideInLeft, SlideOutLeft } from "react-native-reanimated";
import { BlurView } from "expo-blur";

import type { CoachThread } from "@/features/coach/types";
import type { AnalysisHistoryItem } from "@/features/progress/group-sessions";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

import { coachRecordingLabel } from "./recording-picker";

type Props = {
  threads: CoachThread[];
  videos: AnalysisHistoryItem[];
  selectedThreadId: string | null;
  onClose: () => void;
  onNew: () => void;
  onSelect: (thread: CoachThread) => void;
  onRename: (threadId: string, title: string) => Promise<void>;
  onDelete: (threadId: string) => Promise<void>;
};

export function CoachSidebar({ threads, videos, selectedThreadId, onClose, onNew, onSelect, onRename, onDelete }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const videoById = new Map(videos.map((video) => [video.sessionId, video]));

  return (
    <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(100)} style={{ position: "absolute", inset: 0, zIndex: 50, flexDirection: "row", backgroundColor: "rgba(0,0,0,0.68)" }}>
      <Animated.View entering={SlideInLeft.duration(180)} exiting={SlideOutLeft.duration(150)} style={{ width: "86%", maxWidth: 360, overflow: "hidden", gap: spacing.lg, padding: spacing.lg, paddingTop: spacing.xxl, borderRightWidth: 1, borderColor: colors.border, backgroundColor: "rgba(8,8,8,0.78)" }}>
        <BlurView intensity={70} tint="dark" style={{ position: "absolute", inset: 0 }} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text selectable style={[typography.heading, { color: colors.text }]}>Conversations</Text><Pressable accessibilityRole="button" accessibilityLabel="Close conversations" onPress={onClose} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}><Text style={[typography.title, { color: colors.textSecondary }]}>×</Text></Pressable></View>
        <Pressable accessibilityRole="button" accessibilityLabel="New chat" onPress={onNew} style={{ minHeight: 50, flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", borderRadius: radii.md, backgroundColor: colors.gold }}><Text style={[typography.label, { color: colors.background }]}>＋</Text><Text style={[typography.label, { color: colors.background }]}>New chat</Text></Pressable>
        <ScrollView contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xl }}>
          {threads.map((thread) => {
            const video = videoById.get(thread.sessionId);
            const display = thread.title ?? (video ? coachRecordingLabel(video) : "Conversation");
            const selected = selectedThreadId === thread.id;
            return <View key={thread.id} style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radii.sm, borderWidth: 1, borderColor: selected ? colors.gold : colors.border, backgroundColor: selected ? colors.goldSoft : colors.surfaceRaised }}>
              {editingId === thread.id ? <View style={{ gap: spacing.sm }}><TextInput accessibilityLabel="Conversation title" autoFocus value={title} onChangeText={setTitle} maxLength={120} style={[typography.body, { minHeight: 42, paddingHorizontal: spacing.sm, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.gold, color: colors.text }]} /><View style={{ flexDirection: "row", gap: spacing.sm }}><Pressable onPress={() => { const next = title.trim(); if (next) void onRename(thread.id, next).then(() => setEditingId(null)).catch(() => undefined); }}><Text style={[typography.label, { color: colors.gold }]}>Save</Text></Pressable><Pressable onPress={() => setEditingId(null)}><Text style={[typography.label, { color: colors.textSecondary }]}>Cancel</Text></Pressable></View></View> : <Pressable accessibilityRole="button" onPress={() => onSelect(thread)} style={{ gap: 2 }}><Text selectable numberOfLines={1} style={[typography.label, { color: colors.text }]}>{display}</Text><Text selectable style={[typography.caption, { color: colors.textMuted }]}>{new Date(thread.updatedAt).toLocaleDateString()}</Text></Pressable>}
              {editingId !== thread.id ? <View style={{ flexDirection: "row", gap: spacing.md }}><Pressable accessibilityRole="button" onPress={() => { setEditingId(thread.id); setTitle(display); }}><Text style={[typography.caption, { color: colors.textSecondary }]}>Rename</Text></Pressable><Pressable accessibilityRole="button" onPress={() => Alert.alert("Delete conversation?", "This removes only this chat, not the recording or analysis.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => void onDelete(thread.id).catch(() => undefined) }])}><Text style={[typography.caption, { color: colors.danger }]}>Delete</Text></Pressable></View> : null}
            </View>;
          })}
          {threads.length === 0 ? <Text selectable style={[typography.body, { color: colors.textSecondary }]}>Choose a recording to start your first conversation.</Text> : null}
        </ScrollView>
      </Animated.View>
      <Pressable accessibilityRole="button" accessibilityLabel="Close conversations" onPress={onClose} style={{ flex: 1 }} />
    </Animated.View>
  );
}
