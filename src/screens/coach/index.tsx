import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInUp, FadeOut, LinearTransition } from "react-native-reanimated";
import { BlurView } from "expo-blur";

import { ExerciseFamilyIcon } from "@/components/exercise-family-icon";
import { FormButton } from "@/components/form-button";
import { FullRecording } from "@/components/full-recording";
import type { AnalysisStatusResponse } from "@/features/analysis/api";
import { buildCoachingReviewPoints } from "@/features/analysis/review-frames";
import type { CoachConversation, CoachMessage, CoachThread } from "@/features/coach/types";
import type { AnalysisHistoryItem } from "@/features/progress/group-sessions";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

import { CoachSidebar } from "./coach-sidebar";
import { coachRecordingLabel, RecordingPicker } from "./recording-picker";

type SendResult = { threadId: string; userMessage: CoachMessage; assistantMessage: CoachMessage };
type Props = {
  videos: AnalysisHistoryItem[];
  initialSessionId?: string | null;
  initialThreadId?: string | null;
  listThreads?: () => Promise<CoachThread[]>;
  createThread?: (sessionId: string) => Promise<CoachThread>;
  loadConversation?: (threadId: string) => Promise<CoachConversation>;
  loadAnalysis?: (sessionId: string) => Promise<AnalysisStatusResponse>;
  renameThread?: (threadId: string, title: string) => Promise<CoachThread>;
  deleteThread?: (threadId: string) => Promise<void>;
  sendMessage?: (input: { threadId: string; sessionId: string; message: string; clientMessageId: string; targetIntent?: string }) => Promise<SendResult>;
};

const STARTERS = ["Which rep broke down?", "Am I hitting my target?", "What should I change next set?"] as const;
const emptyThreads = async (): Promise<CoachThread[]> => [];
const emptyConversation = async (): Promise<CoachConversation> => ({ thread: null, messages: [] });
const unavailableCreate = async (): Promise<CoachThread> => { throw new Error("Coach is unavailable"); };
const unavailableSend = async (): Promise<SendResult> => { throw new Error("Coach is unavailable"); };
const unavailableRename = async (): Promise<CoachThread> => { throw new Error("Coach is unavailable"); };
const unavailableDelete = async (): Promise<void> => { throw new Error("Coach is unavailable"); };

function formatEvidenceTimestamp(milliseconds: number): string {
  const totalTenths = Math.max(0, Math.round(milliseconds / 100));
  const minutes = Math.floor(totalTenths / 600);
  const seconds = (totalTenths % 600) / 10;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toFixed(1).padStart(4, "0")}`;
}

function newClientMessageId(): string {
  return `coach-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function CoachScreen({ videos, initialSessionId = null, initialThreadId = null, listThreads = emptyThreads, createThread = unavailableCreate, loadConversation = emptyConversation, loadAnalysis, renameThread = unavailableRename, deleteThread = unavailableDelete, sendMessage = unavailableSend }: Props) {
  const insets = useSafeAreaInsets();
  const availableVideos = useMemo(() => videos.filter((video) => video.status === "complete" || video.status === "partial"), [videos]);
  const [threads, setThreads] = useState<CoachThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisStatusResponse | null>(null);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [targetIntent, setTargetIntent] = useState("");
  const [showTargetIntent, setShowTargetIntent] = useState(false);
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const [reviewSeek, setReviewSeek] = useState<{ timeMs: number; requestId: number } | null>(null);
  const [pendingClientMessageId, setPendingClientMessageId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const initialHandled = useRef(false);
  const workspaceScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    let active = true;
    void listThreads().then((value) => active && setThreads(value)).catch((reason) => active && setError(reason instanceof Error ? reason.message : "Conversations could not be loaded"));
    return () => { active = false; };
  }, [listThreads]);

  const chooseRecording = useCallback(async (sessionId: string) => {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const created = await createThread(sessionId);
      setThreads((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setSelectedThreadId(created.id);
      setSelectedSessionId(created.sessionId);
      setMessages([]);
      setAnalysis(null);
      setDraft("");
      setTargetIntent(created.targetIntent ?? "");
      setSelectedFrameId(null);
      setReviewSeek(null);
      setPendingClientMessageId(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Conversation could not be created");
    } finally {
      setCreating(false);
    }
  }, [createThread, creating]);

  useEffect(() => {
    if (initialHandled.current) return;
    if (initialThreadId) {
      const existing = threads.find((item) => item.id === initialThreadId);
      if (!existing) return;
      initialHandled.current = true;
      setSelectedThreadId(existing.id);
      setSelectedSessionId(existing.sessionId);
      return;
    }
    if (initialSessionId && availableVideos.some((video) => video.sessionId === initialSessionId)) {
      initialHandled.current = true;
      void chooseRecording(initialSessionId);
    }
  }, [availableVideos, chooseRecording, initialSessionId, initialThreadId, threads]);

  useEffect(() => {
    if (!selectedThreadId || !selectedSessionId) return;
    let active = true;
    setError(null);
    void loadConversation(selectedThreadId).then((conversation) => {
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
  }, [loadAnalysis, loadConversation, selectedSessionId, selectedThreadId]);

  useEffect(() => {
    if (messages.length > 0) workspaceScrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  const openThread = (thread: CoachThread) => {
    setSelectedThreadId(thread.id);
    setSelectedSessionId(thread.sessionId);
    setMessages([]);
    setAnalysis(null);
    setDraft("");
    setTargetIntent(thread.targetIntent ?? "");
    setSelectedFrameId(null);
    setReviewSeek(null);
    setPendingClientMessageId(null);
    setSidebarOpen(false);
    setError(null);
  };

  const startNewChat = () => {
    setSelectedThreadId(null);
    setSelectedSessionId(null);
    setMessages([]);
    setAnalysis(null);
    setDraft("");
    setTargetIntent("");
    setSelectedFrameId(null);
    setReviewSeek(null);
    setPendingClientMessageId(null);
    setSidebarOpen(false);
    setError(null);
  };

  const handleRename = async (threadId: string, title: string) => {
    try {
      const updated = await renameThread(threadId, title);
      setThreads((current) => current.map((item) => item.id === updated.id ? updated : item));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Conversation could not be renamed.");
      throw reason;
    }
  };

  const handleDelete = async (threadId: string) => {
    try {
      await deleteThread(threadId);
      setThreads((current) => current.filter((item) => item.id !== threadId));
      if (selectedThreadId === threadId) startNewChat();
      else setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Conversation could not be deleted.");
      throw reason;
    }
  };

  const result = analysis?.result ?? null;
  const points = result ? buildCoachingReviewPoints(result) : [];
  const selectedFrame = points.map((point) => point.observed).find((frame) => frame.id === selectedFrameId) ?? null;

  const submit = async () => {
    if (!selectedThreadId || !selectedSessionId || !draft.trim() || sending) return;
    const text = draft.trim();
    const clientMessageId = pendingClientMessageId ?? newClientMessageId();
    setPendingClientMessageId(clientMessageId);
    const optimistic: CoachMessage = { id: `optimistic-${clientMessageId}`, threadId: selectedThreadId, role: "user", content: text, createdAt: new Date().toISOString(), grounding: null };
    setMessages((current) => [...current.filter((item) => !item.id.startsWith("optimistic-")), optimistic]);
    setSending(true);
    setError(null);
    try {
      const response = await sendMessage({ threadId: selectedThreadId, sessionId: selectedSessionId, message: text, clientMessageId, ...(targetIntent.trim() ? { targetIntent: targetIntent.trim() } : {}) });
      setMessages((current) => [...current.filter((item) => item.id !== optimistic.id), response.userMessage, response.assistantMessage]);
      setDraft("");
      setSelectedFrameId(null);
      setPendingClientMessageId(null);
      setThreads((current) => current.map((item) => item.id === selectedThreadId ? { ...item, updatedAt: new Date().toISOString() } : item).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
    } catch (reason) {
      setMessages((current) => current.filter((item) => item.id !== optimistic.id));
      setDraft(text);
      setError(reason instanceof Error ? reason.message : "Coach could not reply");
    } finally {
      setSending(false);
    }
  };

  const changeDraft = (value: string) => {
    setDraft(value);
    if (!sending) setPendingClientMessageId(null);
  };

  const selectedVideo = availableVideos.find((video) => video.sessionId === selectedSessionId) ?? null;
  if (!selectedThreadId || !selectedSessionId || !selectedVideo) {
    return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: "#101010" }}><BlurView testID="coach-blurred-backdrop" intensity={55} tint="dark" style={{ position: "absolute", inset: 0 }} /><View testID="coach-header" style={{ alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: "rgba(9,9,9,0.72)" }}><Text selectable style={[typography.heading, { color: colors.text }]}>Coach</Text></View><RecordingPicker videos={availableVideos} creating={creating} onChoose={(id) => void chooseRecording(id)} />{error ? <Text selectable style={[typography.caption, { padding: spacing.lg, color: colors.danger }]}>{error}</Text> : null}</View>;
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: "#101010" }}>
      <BlurView testID="coach-blurred-backdrop" intensity={55} tint="dark" style={{ position: "absolute", inset: 0 }} />
      <View testID="coach-header" style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: colors.border, backgroundColor: "rgba(9,9,9,0.72)" }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Open conversations" onPress={() => setSidebarOpen(true)} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.text, fontSize: 20 }}>☰</Text></Pressable>
        <Text selectable style={[typography.heading, { color: colors.text }]}>Coach</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Start new chat" onPress={startNewChat} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.gold, fontSize: 22 }}>＋</Text></Pressable>
      </View>
      <ScrollView ref={workspaceScrollRef} keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, gap: spacing.xl, padding: spacing.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          <ExerciseFamilyIcon family={selectedVideo.exerciseFamily ?? "other"} size={40} />
          <View style={{ flex: 1, gap: 2 }}><Text selectable style={[typography.heading, { color: colors.text }]}>{coachRecordingLabel(selectedVideo)}</Text><Text selectable style={[typography.caption, { color: colors.textMuted }]}>{new Date(selectedVideo.createdAt).toLocaleDateString()}</Text><Text selectable numberOfLines={1} style={[typography.caption, { color: colors.gold }]}>{selectedVideo.priorityCorrectionTitles[0] ?? "View analysis"}</Text></View>
          <Text selectable style={[typography.title, { color: colors.gold }]}>{selectedVideo.score ?? "—"}</Text>
        </View>

        {analysis?.videoUrl && analysis.durationMs && result ? <FullRecording videoUrl={analysis.videoUrl} durationMs={analysis.durationMs} reviewFrames={points.map((point) => point.observed)} selectedReviewFrame={selectedFrame} onSelectReviewFrame={(frame) => setSelectedFrameId(frame.id)} seekToMs={reviewSeek?.timeMs ?? null} seekRequestId={reviewSeek?.requestId ?? 0} showActiveFrameCard={false} /> : loadingAnalysis ? <View style={{ minHeight: 180, alignItems: "center", justifyContent: "center", borderRadius: radii.md, backgroundColor: colors.surface }}><Text selectable style={[typography.body, { color: colors.textSecondary }]}>Loading video evidence…</Text></View> : null}

        {points.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>{points.map((point, index) => { const selected = selectedFrameId === point.observed.id; return <Pressable accessibilityRole="button" key={point.id} onPress={() => setSelectedFrameId(point.observed.id)} style={{ minHeight: 54, maxWidth: 220, justifyContent: "center", gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: selected ? colors.gold : colors.border, backgroundColor: selected ? colors.goldSoft : colors.surface }}><Text selectable style={[typography.caption, { color: colors.gold }]}>{index + 1} · {formatEvidenceTimestamp(point.observed.timeMs)}</Text><Text selectable numberOfLines={1} style={[typography.label, { color: colors.text }]}>{point.observed.title}</Text></Pressable>; })}</ScrollView> : null}

        <View style={{ flex: 1, minHeight: 220, gap: spacing.md }}>
          {messages.length === 0 ? <Animated.View entering={FadeInUp.duration(180)} style={{ flex: 1, justifyContent: "center", gap: spacing.lg }}><View style={{ gap: spacing.sm, alignItems: "center" }}><Text selectable style={[typography.heading, { color: colors.text, textAlign: "center" }]}>Ask about this set</Text><Text selectable style={[typography.body, { color: colors.textSecondary, textAlign: "center" }]}>Formie can reference moments from this recording.</Text></View><View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>{STARTERS.map((starter) => <Pressable key={starter} accessibilityRole="button" onPress={() => changeDraft(starter)} style={{ minHeight: 46, flexGrow: 1, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}><Text style={[typography.caption, { color: colors.text }]}>{starter}</Text></Pressable>)}</View></Animated.View> : <View style={{ gap: spacing.md }}>{messages.map((message, index) => <Animated.View entering={FadeInUp.delay(Math.min(index, 4) * 30).duration(180)} exiting={FadeOut.duration(100)} key={message.id} layout={LinearTransition.duration(140)} testID={`coach-message-${message.role}`} style={{ maxWidth: "88%", alignSelf: message.role === "user" ? "flex-end" : "flex-start", gap: spacing.xs, padding: spacing.md, borderRadius: radii.md, borderWidth: message.role === "assistant" ? 1 : 0, borderColor: colors.border, backgroundColor: message.role === "user" ? colors.surfaceRaised : colors.surface }}><Text selectable style={[typography.caption, { color: message.role === "assistant" ? colors.gold : colors.textMuted }]}>{message.role === "assistant" ? "Formie Coach" : "You"}</Text><Text selectable style={[typography.body, { color: colors.text }]}>{message.content}</Text>{message.role === "assistant" && message.grounding && message.grounding.scope !== "insufficient" && message.grounding.startMs !== null && message.grounding.endMs !== null ? <Pressable accessibilityRole="button" accessibilityLabel={`Seek reviewed video from ${formatEvidenceTimestamp(message.grounding.startMs)} to ${formatEvidenceTimestamp(message.grounding.endMs)}`} onPress={() => setReviewSeek((current) => ({ timeMs: message.grounding?.startMs ?? 0, requestId: (current?.requestId ?? 0) + 1 }))} style={{ alignSelf: "flex-start", minHeight: 36, justifyContent: "center", paddingHorizontal: spacing.sm, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.gold }}><Text selectable style={[typography.caption, { color: colors.gold }]}>Reviewed {formatEvidenceTimestamp(message.grounding.startMs)}–{formatEvidenceTimestamp(message.grounding.endMs)}</Text></Pressable> : null}</Animated.View>)}</View>}
        </View>
      </ScrollView>

      <View testID="coach-composer" style={{ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: Math.max(insets.bottom, spacing.sm), paddingTop: spacing.sm, borderTopWidth: 1, borderColor: colors.border, backgroundColor: "rgba(9,9,9,0.78)" }}>
        {showTargetIntent ? <TextInput accessibilityLabel="Target muscle or area" value={targetIntent} onChangeText={setTargetIntent} placeholder="Optional target, e.g. upper back" placeholderTextColor={colors.textMuted} maxLength={240} style={[typography.body, { minHeight: 42, paddingHorizontal: spacing.md, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border, color: colors.text }]} /> : null}
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm }}><Pressable accessibilityRole="button" accessibilityLabel="Set target area" onPress={() => setShowTargetIntent((value) => !value)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.text, fontSize: 20 }}>＋</Text></Pressable><TextInput accessibilityLabel="Message your coach" multiline value={draft} onChangeText={changeDraft} placeholder="Ask about this set" placeholderTextColor={colors.textMuted} maxLength={2000} style={[typography.body, { flex: 1, maxHeight: 110, minHeight: 52, padding: spacing.md, borderRadius: radii.pill, borderWidth: 1, borderColor: error ? colors.danger : colors.border, color: colors.text, backgroundColor: colors.surface }]} /><View style={{ width: 82 }}><FormButton label={sending ? "Sending" : "Send"} disabled={!draft.trim() || sending} onPress={() => void submit()} /></View></View>
        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>Ask naturally about a rep, timestamp, movement, or the full set.</Text>
        {error ? <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}><Text selectable style={[typography.caption, { flex: 1, color: colors.danger }]}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void submit()} style={{ minWidth: 48, minHeight: 44, alignItems: "center", justifyContent: "center" }}><Text style={[typography.label, { color: colors.gold }]}>Retry</Text></Pressable></View> : null}
      </View>
      {sidebarOpen ? <CoachSidebar threads={threads} videos={availableVideos} selectedThreadId={selectedThreadId} onClose={() => setSidebarOpen(false)} onNew={startNewChat} onSelect={openThread} onRename={handleRename} onDelete={handleDelete} /> : null}
    </KeyboardAvoidingView>
  );
}
