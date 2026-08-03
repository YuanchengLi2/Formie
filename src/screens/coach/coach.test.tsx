import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import type { AnalysisStatusResponse } from "@/features/analysis/api";
import type { CoachThread } from "@/features/coach/types";
import type { AnalysisHistoryItem } from "@/features/progress/group-sessions";

import { CoachScreen } from ".";

const sessionId = "11111111-1111-4111-8111-111111111111";
const threadId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";
const video = (id = sessionId, correctedLabel: string | null = null): AnalysisHistoryItem => ({ sessionId: id, status: "complete", createdAt: "2026-07-16T10:00:00Z", detectedLabel: "Cable row", correctedLabel, exerciseFamily: "row", score: 82, priorityCorrectionTitles: ["Level the shoulders"], comparisonSummary: null, priorityIssueImproved: null });
const thread = (id = threadId, session = sessionId, title: string | null = null): CoachThread => ({ id, userId, sessionId: session, title, targetIntent: null, createdAt: "2026-07-22T10:00:00Z", updatedAt: "2026-07-22T10:00:00Z" });
const withSafeArea = (children: React.ReactNode) => <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>{children}</SafeAreaProvider>;
type SendInput = { threadId: string; sessionId: string; message: string; clientMessageId: string; targetIntent?: string; evidence?: unknown };

const analysis = async (): Promise<AnalysisStatusResponse> => ({
  sessionId,
  status: "complete",
  stage: "coaching",
  failureCode: null,
  failureReason: null,
  durationMs: 5_000,
  playbackWindow: null,
  videoUrl: "https://storage.example/set.mp4",
  result: {
    status: "complete",
    analysisBasis: "observed",
    viewNotes: [],
    generalGuidance: [],
    recognition: { label: "Cable row", variation: null, equipment: ["cable"], confidence: 0.9, alternatives: [], catalogExerciseId: null, exerciseFamily: "row" },
    videoCheck: { outcome: "usable", usableObservations: ["upper body visible"], limitations: [], retryReason: null, retryInstruction: null },
    overallAssessment: "The set is reviewable.", muscleFocus: { primary: [], secondary: [], unclassified: [] }, coachNote: null, score: 82, scoreRationale: [], didWell: [],
    priorityCorrections: [{ id: "shoulder", coachingArea: "form", title: "Level the shoulders", detail: "The right shoulder rises.", whyItMatters: "Uneven pulling reduces repeatability.", correction: "Keep both shoulders level.", cue: "Level shoulders.", severity: "important", evidence: [{ startMs: 1_000, peakMs: 1_300, endMs: 1_600, repNumber: 1, phase: "top", visualEvidence: "The right shoulder rises first.", coachingNote: "Keep both shoulders level.", visibleBodyAreas: ["shoulders"], confidence: 0.9, focusRegion: null }] }],
    coachingCues: [], setContext: { cameraView: "down-front diagonal", visibleReferences: ["shoulders"], sequenceSummary: "Three repetitions.", changeAcrossSet: "The right shoulder rose on later reps.", coachingBasis: "Keep both shoulders level." }, setSummary: { totalReps: 3, consistentReps: 2, verdict: "One shoulder rises." }, repTimeline: [], nextSetPlan: [], precisionRequest: { requestedRuns: 0, reason: null, targets: [] }, comparison: null,
  },
});

describe("CoachScreen", () => {
  it("uses a searchable neutral recording picker and creates a new thread", async () => {
    const createThread = jest.fn(async () => thread());
    const screen = await render(withSafeArea(<CoachScreen videos={[video()]} listThreads={async () => []} createThread={createThread} loadConversation={async () => ({ thread: thread(), messages: [] })} loadAnalysis={analysis} />));
    expect(await screen.findByText("Choose a set")).toBeTruthy();
    expect(screen.getByText("Coach")).toBeTruthy();
    expect(screen.queryByText("FORM COACH")).toBeNull();
    expect(screen.getByText("Analyzed set")).toBeTruthy();
    expect(screen.getByTestId("coach-header")).toHaveStyle({ backgroundColor: "rgba(9,9,9,0.72)" });
    expect(screen.getByTestId("coach-blurred-backdrop")).toBeTruthy();
    expect(screen.getByTestId("coach-recording-icon")).toHaveStyle({ width: 72, height: 72 });
    expect(screen.getByLabelText("row exercise icon")).toHaveStyle({ width: 48, height: 48 });
    expect(screen.queryByText("Cable row")).toBeNull();
    await fireEvent.changeText(screen.getByLabelText("Search recordings"), "nothing");
    expect(screen.getByText("No matching recordings")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Search recordings"), "analyzed");
    await fireEvent.press(screen.getByLabelText("Ask Formie about analyzed set"));
    await waitFor(() => expect(createThread).toHaveBeenCalledWith(sessionId));
    await waitFor(() => expect(screen.getByLabelText("Message your coach")).toBeTruthy());
    expect(screen.getByTestId("coach-header")).toHaveStyle({ backgroundColor: "rgba(9,9,9,0.72)" });
    expect(screen.getByTestId("coach-composer")).toHaveStyle({ backgroundColor: "rgba(9,9,9,0.78)" });
    expect(screen.queryByTestId("coach-message-assistant")).toBeNull();
  });

  it("sends natural language without silent evidence and shows a reviewed range", async () => {
    const grounding = { scope: "focused_window" as const, startMs: 3_500, endMs: 9_500, citations: [{ timeMs: 5_500, label: "The right shoulder rises." }] };
    const sendMessage = jest.fn(async (input: SendInput) => ({ threadId, userMessage: { id: "44444444-4444-4444-8444-444444444444", threadId, role: "user" as const, content: input.message, createdAt: "now", grounding: null }, assistantMessage: { id: "55555555-5555-4555-8555-555555555555", threadId, role: "assistant" as const, content: "At 00:05.5, level your shoulders.", createdAt: "now", grounding } }));
    const screen = await render(withSafeArea(<CoachScreen videos={[video()]} initialSessionId={sessionId} listThreads={async () => []} createThread={async () => thread()} loadConversation={async () => ({ thread: thread(), messages: [] })} loadAnalysis={analysis} sendMessage={sendMessage} />));
    await waitFor(() => expect(screen.getByLabelText("Message your coach")).toBeTruthy());
    expect(screen.queryByTestId("coach-evidence-context")).toBeNull();
    await fireEvent.changeText(screen.getByLabelText("Message your coach"), "What happens here?");
    await fireEvent.press(screen.getByText("Send"));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ threadId, sessionId, clientMessageId: expect.any(String) })));
    expect(sendMessage.mock.calls[0][0].evidence).toBeUndefined();
    expect(await screen.findByText("Reviewed 00:03.5–00:09.5")).toBeTruthy();
  });

  it("keeps the draft and stable message id when a send fails", async () => {
    const sendMessage = jest.fn(async (_input: SendInput) => { throw new Error("Offline"); });
    const screen = await render(withSafeArea(<CoachScreen videos={[video()]} initialSessionId={sessionId} listThreads={async () => []} createThread={async () => thread()} loadConversation={async () => ({ thread: thread(), messages: [] })} loadAnalysis={analysis} sendMessage={sendMessage} />));
    await waitFor(() => expect(screen.getByLabelText("Message your coach")).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText("Message your coach"), "Help");
    await fireEvent.press(screen.getByText("Send"));
    await waitFor(() => expect(screen.getByText("Retry")).toBeTruthy());
    expect(screen.getByLabelText("Message your coach").props.value).toBe("Help");
    const firstId = sendMessage.mock.calls[0][0].clientMessageId;
    await fireEvent.press(screen.getByText("Retry"));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2));
    expect(sendMessage.mock.calls[1][0].clientMessageId).toBe(firstId);
    expect(sendMessage.mock.calls[0][0].evidence).toBeUndefined();
  });

  it("opens the sidebar, restores chats, and starts another chat for the same recording", async () => {
    const existing = thread(threadId, sessionId, "Row questions");
    const secondId = "66666666-6666-4666-8666-666666666666";
    const createThread = jest.fn(async () => thread(secondId));
    const screen = await render(withSafeArea(<CoachScreen videos={[video()]} initialThreadId={threadId} listThreads={async () => [existing]} createThread={createThread} loadConversation={async () => ({ thread: existing, messages: [] })} loadAnalysis={analysis} />));
    await waitFor(() => expect(screen.getByLabelText("Open conversations")).toBeTruthy());
    await fireEvent.press(screen.getByLabelText("Open conversations"));
    expect(screen.getByText("Row questions")).toBeTruthy();
    await fireEvent.press(screen.getByText("New chat"));
    expect(await screen.findByText("Choose a set")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Ask Formie about analyzed set"));
    await waitFor(() => expect(createThread).toHaveBeenCalledWith(sessionId));
  });
});
