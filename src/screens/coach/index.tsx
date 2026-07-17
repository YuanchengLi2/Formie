import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInUp, FadeOut, LinearTransition } from "react-native-reanimated";

import { ExerciseFamilyIcon } from "@/components/exercise-family-icon";
import { FormButton } from "@/components/form-button";
import { FullRecording, formatPlaybackTime } from "@/components/full-recording";
import type { AnalysisStatusResponse } from "@/features/analysis/api";
import { buildCoachingReviewPoints } from "@/features/analysis/review-frames";
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
  loadAnalysis?: (sessionId: string) => Promise<AnalysisStatusResponse>;
  sendMessage?: (input: { sessionId: string; message: string; targetIntent?: string }) => Promise<SendResult>;
};

const STARTERS = ["Check my form", "Am I hitting my target muscle?", "What should I change next set?", "Which repetition broke down?"] as const;
const emptyConversation = async (): Promise<CoachConversation> => ({ thread: null, messages: [] });
const unavailableCoach = async (): Promise<SendResult> => { throw new Error("Coach is unavailable"); };

function exerciseLabel(video: AnalysisHistoryItem): string {
  return video.correctedLabel ?? video.detectedLabel ?? "Analyzed movement";
}

export function CoachScreen({ videos, initialSessionId = null, loadConversation = emptyConversation, loadAnalysis, sendMessage = unavailableCoach }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const availableVideos = useMemo(() => videos.filter((video) => video.status === "complete" || video.status === "partial"), [videos]);
  const initial = initialSessionId && availableVideos.some((video) => video.sessionId === initialSessionId) ? initialSessionId : null;
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(initial);
  const [analysis, setAnalysis] = useState<AnalysisStatusResponse | null>(null);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [targetIntent, setTargetIntent] = useState("");
  const [showTargetIntent, setShowTargetIntent] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const workspaceScrollRef = useRef<ScrollView>(null);
  const selected = availableVideos.find((video) => video.sessionId === selectedSessionId) ?? null;

  useEffect(() => {
    if (messages.length > 0) workspaceScrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  useEffect(() => {
    if (!selectedSessionId) return;
    let active = true;
    setError(null);
    void loadConversation(selectedSessionId).then((conversation) => {
      if (!active) return;
      setMessages(conversation.messages);
      if (conversation.thread?.targetIntent) {
        setTargetIntent(conversation.thread.targetIntent);
        setShowTargetIntent(true);
      }
    }).catch((reason) => active && setError(reason instanceof Error ? reason.message : "Conversation could not be loaded"));
    if (loadAnalysis) {
      setLoadingAnalysis(true);
      void loadAnalysis(selectedSessionId).then((value) => {
        if (!active) return;
        setAnalysis(value);
        setSelectedFrameId(null);
      }).catch((reason) => active && setError(reason instanceof Error ? reason.message : "Recording could not be loaded")).finally(() => active && setLoadingAnalysis(false));
    }
    return () => { active = false; };
  }, [loadAnalysis, loadConversation, selectedSessionId]);

  const chooseVideo = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setAnalysis(null);
    setMessages([]);
    setDraft("");
    setError(null);
    setSelectedFrameId(null);
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
        <Text selectable style={[typography.heading, { color: colors.gold, textAlign: "center", letterSpacing: 2 }]}>FORM Coach</Text>
        <View style={{ gap: spacing.sm }}><Text selectable style={[typography.title, { color: colors.text }]}>Choose a video to ask your coach</Text><Text selectable style={[typography.body, { maxWidth: 560, color: colors.textSecondary }]}>Your coach uses the selected recording, timestamps, and saved analysis to answer.</Text></View>
        <ScrollView accessibilityLabel="Analyzed video selector" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
          {availableVideos.map((video) => <Pressable key={video.sessionId} accessibilityRole="button" onPress={() => chooseVideo(video.sessionId)} style={({ pressed }) => ({ width: Math.min(280, width - 64), minHeight: 128, justifyContent: "space-between", gap: spacing.md, padding: spacing.lg, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.goldSoft : colors.surface })}><View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}><ExerciseFamilyIcon family={video.exerciseFamily ?? "other"} size={48} /><View style={{ flex: 1 }}><Text selectable style={[typography.heading, { color: colors.text }]}>{exerciseLabel(video)}</Text><Text selectable style={[typography.caption, { color: colors.textMuted }]}>{new Date(video.createdAt).toLocaleDateString()}</Text></View></View><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text selectable style={[typography.caption, { color: colors.gold }]}>Open coaching workspace</Text><Text selectable style={[typography.heading, { color: colors.gold }]}>{video.score ?? "Review"}</Text></View></Pressable>)}
        </ScrollView>
        {availableVideos.length === 0 ? <Text selectable style={[typography.body, { color: colors.textSecondary }]}>Record and analyze a set to start a coaching conversation.</Text> : null}
      </ScrollView>
    );
  }

  const result = analysis?.result ?? null;
  const points = result ? buildCoachingReviewPoints(result) : [];
  const selectedFrame = points.map((point) => point.observed).find((frame) => frame.id === selectedFrameId) ?? points[0]?.observed ?? null;
  const workspaceWide = width >= 760;

  const videoWorkspace = (
    <View style={{ flex: workspaceWide ? 1 : undefined, gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
        <ExerciseFamilyIcon family={selected.exerciseFamily ?? "other"} size={48} />
        <View style={{ flex: 1, gap: 2 }}><Text selectable style={[typography.heading, { color: colors.text }]}>{exerciseLabel(selected)}</Text><Text selectable style={[typography.caption, { color: colors.textMuted }]}>{new Date(selected.createdAt).toLocaleDateString()}</Text></View>
        <Text selectable style={[typography.title, { color: colors.gold }]}>{selected.score ?? "—"}</Text>
        <Pressable accessibilityRole="button" onPress={() => setSelectedSessionId(null)} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}><Text style={[typography.label, { color: colors.gold }]}>Change</Text></Pressable>
      </View>

      {analysis?.videoUrl && analysis.durationMs && result ? <FullRecording videoUrl={analysis.videoUrl} durationMs={analysis.durationMs} reviewFrames={points.map((point) => point.observed)} selectedReviewFrame={selectedFrame} onSelectReviewFrame={(frame) => setSelectedFrameId(frame.id)} showActiveFrameCard={false} /> : loadingAnalysis ? <View style={{ minHeight: 180, alignItems: "center", justifyContent: "center", borderRadius: radii.md, backgroundColor: colors.surface }}><Text selectable style={[typography.body, { color: colors.textSecondary }]}>Loading video evidence…</Text></View> : null}

      {points.length > 0 ? <View style={{ gap: spacing.sm }}><Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 1.2 }]}>COACHING MOMENTS</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>{points.map((point, index) => { const selectedPoint = selectedFrame?.id === point.observed.id; return <Pressable accessibilityRole="button" key={point.id} onPress={() => setSelectedFrameId(point.observed.id)} style={{ minHeight: 58, maxWidth: 220, justifyContent: "center", gap: spacing.xs, paddingHorizontal: spacing.lg, borderRadius: radii.md, borderWidth: 1, borderColor: selectedPoint ? colors.gold : colors.border, backgroundColor: selectedPoint ? colors.goldSoft : colors.surface }}><Text selectable style={[typography.caption, { color: colors.gold }]}>{index + 1} · {formatPlaybackTime(point.observed.timeMs)}</Text><Text selectable numberOfLines={1} style={[typography.label, { color: colors.text }]}>{point.observed.finding.title}</Text></Pressable>; })}</ScrollView></View> : null}

      <View style={{ gap: spacing.sm }}>
        <Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 1.4 }]}>ANALYSIS CONTEXT</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          <Pressable onPress={() => setShowTargetIntent((value) => !value)} style={{ minHeight: 40, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border }}><Text style={[typography.caption, { color: colors.textSecondary }]}>Target · {targetIntent || "Add"}</Text></Pressable>
          <View style={{ minHeight: 40, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border }}><Text selectable style={[typography.caption, { color: colors.textSecondary }]}>{result?.recognition.variation ?? result?.recognition.exerciseFamily ?? "Video analysis"}</Text></View>
        </View>
        {result?.setContext.changeAcrossSet ? <Animated.View entering={FadeInUp.duration(200)} layout={LinearTransition.duration(160)} style={{ gap: spacing.xs, padding: spacing.md, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}><Text selectable style={[typography.caption, { color: colors.gold, letterSpacing: 1.1 }]}>WHOLE-SET CONTEXT</Text><Text selectable style={[typography.body, { color: colors.textSecondary }]}>{result.setContext.changeAcrossSet}</Text></Animated.View> : null}
        {showTargetIntent ? <TextInput accessibilityLabel="Target muscle or area" value={targetIntent} onChangeText={setTargetIntent} placeholder="Optional, e.g. upper back" placeholderTextColor={colors.textMuted} maxLength={240} style={[typography.body, { minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border, color: colors.text }]} /> : null}
        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>FORM only uses details visible in this recording.</Text>
      </View>
    </View>
  );

  const conversation = (
    <View style={{ flex: workspaceWide ? 1 : undefined, minHeight: workspaceWide ? 520 : undefined, gap: spacing.md }}>
      {messages.length === 0 ? (
        <Animated.View entering={FadeInUp.duration(220)} style={{ flex: 1, justifyContent: "center", gap: spacing.lg, paddingVertical: spacing.xl }}>
          <View style={{ gap: spacing.sm, alignItems: "center" }}><Text selectable style={[typography.heading, { color: colors.text, textAlign: "center" }]}>What do you want to improve?</Text><Text selectable style={[typography.body, { maxWidth: 520, color: colors.textSecondary, textAlign: "center" }]}>Ask about your technique, muscle targeting, setup, or a specific moment in this recording.</Text><Text selectable style={[typography.caption, { color: colors.textMuted, textAlign: "center" }]}>If the camera angle limits an answer, FORM will tell you.</Text></View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {STARTERS.map((starter, index) => <Animated.View entering={FadeInUp.delay(index * 45).duration(220)} key={starter} layout={LinearTransition.duration(160)} style={{ flexGrow: 1, flexBasis: width >= 540 ? "46%" : "100%" }}><Pressable accessibilityRole="button" onPress={() => setDraft(starter)} style={({ pressed }) => ({ minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, paddingHorizontal: spacing.md, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.goldSoft : colors.surface })}><Text style={[typography.body, { flex: 1, color: colors.text }]}>{starter}</Text><Text style={{ color: colors.gold, fontSize: 22 }}>›</Text></Pressable></Animated.View>)}
          </View>
        </Animated.View>
      ) : (
        <View style={{ gap: spacing.md }}>
          {messages.map((message, index) => <Animated.View entering={FadeInUp.delay(Math.min(index, 4) * 35).duration(200)} exiting={FadeOut.duration(120)} key={message.id} layout={LinearTransition.duration(160)} testID={`coach-message-${message.role}`} style={{ maxWidth: "88%", alignSelf: message.role === "user" ? "flex-end" : "flex-start", gap: spacing.xs, padding: spacing.md, borderRadius: radii.md, borderCurve: "continuous", borderWidth: message.role === "assistant" ? 1 : 0, borderColor: colors.border, backgroundColor: message.role === "user" ? colors.goldSoft : colors.surface }}><Text selectable style={[typography.caption, { color: message.role === "assistant" ? colors.gold : colors.textMuted }]}>{message.role === "assistant" ? "FORM Coach" : "You"}</Text><Text selectable style={[typography.body, { color: colors.text }]}>{message.content}</Text></Animated.View>)}
        </View>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg }}><Text selectable style={[typography.heading, { color: colors.gold, textAlign: "center", letterSpacing: 2 }]}>FORM Coach</Text></View>
      <ScrollView ref={workspaceScrollRef} contentInsetAdjustmentBehavior="automatic" onContentSizeChange={() => messages.length > 0 && workspaceScrollRef.current?.scrollToEnd({ animated: true })} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, flexDirection: workspaceWide ? "row" : "column", alignItems: "stretch", gap: spacing.xl, padding: spacing.lg }}>
        {videoWorkspace}
        {conversation}
      </ScrollView>
      <View style={{ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm }}><TextInput accessibilityLabel="Message your coach" multiline value={draft} onChangeText={setDraft} placeholder="Ask about this recording…" placeholderTextColor={colors.textMuted} maxLength={2000} style={[typography.body, { flex: 1, maxHeight: 110, minHeight: 52, padding: spacing.md, borderRadius: radii.pill, borderWidth: 1, borderColor: error ? colors.danger : colors.border, color: colors.text, backgroundColor: colors.surface }]} /><View style={{ width: 86 }}><FormButton label={sending ? "Sending" : "Send"} disabled={!draft.trim() || sending} onPress={() => void submit()} /></View></View>
        {selectedFrame ? <Animated.View accessibilityLabel={`Selected evidence: ${selectedFrame.title} at ${formatPlaybackTime(selectedFrame.timeMs)}`} entering={FadeInUp.duration(180)} key={selectedFrame.id} layout={LinearTransition.duration(160)} testID="coach-evidence-context" style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.gold }} /><Text selectable numberOfLines={1} style={[typography.caption, { flex: 1, color: colors.textSecondary }]}>{formatPlaybackTime(selectedFrame.timeMs)} · {selectedFrame.title}</Text></Animated.View> : <Text selectable style={[typography.caption, { color: colors.textMuted }]}>Video evidence attached</Text>}
        {error ? <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}><Text selectable style={[typography.caption, { flex: 1, color: colors.danger }]}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void submit()} style={{ minWidth: 48, minHeight: 44, alignItems: "center", justifyContent: "center" }}><Text style={[typography.label, { color: colors.gold }]}>Retry</Text></Pressable></View> : null}
      </View>
    </KeyboardAvoidingView>
  );
}
