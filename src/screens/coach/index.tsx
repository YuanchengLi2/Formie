import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ExerciseFamilyIcon } from "@/components/exercise-family-icon";
import { FormButton } from "@/components/form-button";
import { FormWordmark } from "@/components/form-wordmark";
import type { CoachConversation, CoachMessage } from "@/features/coach/types";
import type { AnalysisHistoryItem } from "@/features/progress/group-sessions";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

type SendResult = { threadId: string; userMessage: CoachMessage; assistantMessage: CoachMessage };
type Props = {
  videos: AnalysisHistoryItem[];
  initialSessionId?: string | null;
  loadConversation?: (sessionId: string) => Promise<CoachConversation>;
  sendMessage?: (input: { sessionId: string; message: string; targetIntent?: string }) => Promise<SendResult>;
};

const emptyConversation = async (): Promise<CoachConversation> => ({ thread: null, messages: [] });
const unavailableCoach = async (): Promise<SendResult> => { throw new Error("Coach is unavailable"); };

export function CoachScreen({ videos, initialSessionId = null, loadConversation = emptyConversation, sendMessage = unavailableCoach }: Props) {
  const insets = useSafeAreaInsets();
  const availableVideos = useMemo(() => videos.filter((video) => video.status === "complete" || video.status === "partial"), [videos]);
  const initial = initialSessionId && availableVideos.some((video) => video.sessionId === initialSessionId) ? initialSessionId : null;
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(initial);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [targetIntent, setTargetIntent] = useState("");
  const [showTargetIntent, setShowTargetIntent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = availableVideos.find((video) => video.sessionId === selectedSessionId) ?? null;

  useEffect(() => {
    if (!selectedSessionId) return;
    let active = true;
    void loadConversation(selectedSessionId).then((conversation) => {
      if (!active) return;
      setMessages(conversation.messages);
      if (conversation.thread?.targetIntent) {
        setTargetIntent(conversation.thread.targetIntent);
        setShowTargetIntent(true);
      }
    }).catch((reason) => active && setError(reason instanceof Error ? reason.message : "Conversation could not be loaded"));
    return () => { active = false; };
  }, [loadConversation, selectedSessionId]);

  const chooseVideo = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setMessages([]);
    setDraft("");
    setError(null);
  };
  const submit = async () => {
    if (!selectedSessionId || !draft.trim() || sending) return;
    const text = draft.trim();
    const optimistic: CoachMessage = { id: `optimistic-${Date.now()}`, threadId: "pending", role: "user", content: text, createdAt: new Date().toISOString() };
    setMessages((current) => [...current.filter((item) => !item.id.startsWith("optimistic-")), optimistic]);
    setSending(true);
    setError(null);
    try {
      const response = await sendMessage({ sessionId: selectedSessionId, message: text, ...(targetIntent.trim() ? { targetIntent: targetIntent.trim() } : {}) });
      setMessages((current) => [...current.filter((item) => item.id !== optimistic.id), response.userMessage, response.assistantMessage]);
      setDraft("");
    } catch (reason) {
      setMessages((current) => current.filter((item) => item.id !== optimistic.id));
      setDraft(text);
      setError(reason instanceof Error ? reason.message : "Coach could not reply");
    } finally {
      setSending(false);
    }
  };

  if (!selected) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ flexGrow: 1, gap: spacing.xl, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl, paddingHorizontal: spacing.lg }}>
        <FormWordmark />
        <View style={{ gap: spacing.sm }}><Text selectable style={[typography.title, { color: colors.text }]}>Choose a video to ask your coach</Text><Text selectable style={[typography.body, { color: colors.textSecondary }]}>Your coach uses the selected recording, timestamps, and saved analysis to answer.</Text></View>
        <View style={{ gap: spacing.sm }}>{availableVideos.map((video) => <Pressable key={video.sessionId} accessibilityRole="button" onPress={() => chooseVideo(video.sessionId)} style={{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: colors.border }}><ExerciseFamilyIcon family={video.exerciseFamily ?? "other"} size={48} /><View style={{ flex: 1 }}><Text selectable style={[typography.label, { color: colors.text }]}>{video.correctedLabel ?? video.detectedLabel ?? "Analyzed movement"}</Text><Text selectable style={[typography.caption, { color: colors.textMuted }]}>{new Date(video.createdAt).toLocaleDateString()} · {video.status}</Text></View><Text selectable style={[typography.heading, { color: colors.gold }]}>{video.score === null ? "View" : video.score}</Text></Pressable>)}</View>
        {availableVideos.length === 0 ? <Text selectable style={[typography.body, { color: colors.textSecondary }]}>Record and analyze a set to start a coaching conversation.</Text> : null}
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ gap: spacing.md, paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg }}>
        <FormWordmark />
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}><ExerciseFamilyIcon family={selected.exerciseFamily ?? "other"} size={48} /><View style={{ flex: 1 }}><Text selectable style={[typography.heading, { color: colors.text }]}>{selected.correctedLabel ?? selected.detectedLabel ?? "Analyzed movement"}</Text><Text selectable style={[typography.caption, { color: colors.textMuted }]}>Video-aware AI Coach</Text></View><Pressable accessibilityRole="button" onPress={() => setSelectedSessionId(null)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={[typography.label, { color: colors.gold }]}>Change Video</Text></Pressable></View>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: messages.length ? "flex-start" : "center", gap: spacing.md, padding: spacing.lg }}>
        {messages.length === 0 ? <Text selectable style={[typography.body, { color: colors.textSecondary, textAlign: "center" }]}>Ask about visible technique, a timestamp, or how your setup may bias the movement toward your target.</Text> : messages.map((message) => <View key={message.id} style={{ maxWidth: "88%", alignSelf: message.role === "user" ? "flex-end" : "flex-start", padding: spacing.md, borderRadius: radii.md, backgroundColor: message.role === "user" ? colors.goldSoft : colors.surfaceRaised }}><Text selectable style={[typography.body, { color: colors.text }]}>{message.content}</Text></View>)}
      </ScrollView>
      <View style={{ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.sm }}>
        <Pressable onPress={() => setShowTargetIntent((value) => !value)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={[typography.caption, { color: colors.gold }]}>What are you trying to target?</Text></Pressable>
        {showTargetIntent ? <TextInput accessibilityLabel="Target muscle or area" value={targetIntent} onChangeText={setTargetIntent} placeholder="Optional, e.g. upper back" placeholderTextColor={colors.textMuted} maxLength={240} style={[typography.body, { minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border, color: colors.text }]} /> : null}
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm }}><TextInput accessibilityLabel="Message your coach" multiline value={draft} onChangeText={setDraft} placeholder="Ask about this video…" placeholderTextColor={colors.textMuted} maxLength={2000} style={[typography.body, { flex: 1, maxHeight: 110, minHeight: 48, padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: error ? colors.danger : colors.border, color: colors.text }]} /><View style={{ width: 82 }}><FormButton label={sending ? "Sending" : "Send"} disabled={!draft.trim() || sending} onPress={() => void submit()} /></View></View>
        {error ? <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}><Text selectable style={[typography.caption, { flex: 1, color: colors.danger }]}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void submit()} style={{ minWidth: 48, minHeight: 44, alignItems: "center", justifyContent: "center" }}><Text style={[typography.label, { color: colors.gold }]}>Retry</Text></Pressable></View> : null}
      </View>
    </KeyboardAvoidingView>
  );
}
