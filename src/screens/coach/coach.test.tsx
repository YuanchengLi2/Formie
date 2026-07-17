import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import type { AnalysisHistoryItem } from "@/features/progress/group-sessions";
import type { AnalysisStatusResponse } from "@/features/analysis/api";

import { CoachScreen } from ".";

const video = (sessionId: string, status: AnalysisHistoryItem["status"] = "complete"): AnalysisHistoryItem => ({ sessionId, status, createdAt: "2026-07-16T10:00:00Z", detectedLabel: "Cable row", correctedLabel: null, exerciseFamily: "row", score: 82, priorityCorrectionTitles: [], comparisonSummary: null, priorityIssueImproved: null });
const withSafeArea = (children: React.ReactNode) => <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>{children}</SafeAreaProvider>;

describe("CoachScreen", () => {
  it("uses the selected analyzed video as a visible coaching workspace with starter prompts", async () => {
    const loadAnalysis = jest.fn(async (): Promise<AnalysisStatusResponse> => ({
      sessionId: "complete",
      status: "complete",
      stage: "coaching",
      durationMs: 5_000,
      videoUrl: "https://storage.example/set.mp4",
      result: {
        status: "complete",
        recognition: { label: "Cable row", variation: null, equipment: ["cable"], confidence: 0.9, alternatives: [], catalogExerciseId: null, exerciseFamily: "row" },
        videoCheck: { outcome: "usable", usableObservations: ["upper body visible"], limitations: [], retryReason: null, retryInstruction: null },
        overallAssessment: "The set is reviewable.", score: 82, scoreRationale: [], didWell: [],
        priorityCorrections: [{ id: "shoulder", title: "Level the shoulders", detail: "The right shoulder rises.", whyItMatters: "Uneven pulling reduces repeatability.", correction: "Keep both shoulders level.", cue: "Level shoulders.", severity: "important", evidence: [{ startMs: 1_000, peakMs: 1_300, endMs: 1_600, repNumber: 1, phase: "pull", visualEvidence: "The right shoulder rises first.", coachingNote: "your right shoulder rises first. Pull both shoulders level.", visibleBodyAreas: ["shoulders"], confidence: 0.9, focusRegion: { centerX: 0.58, centerY: 0.36, radius: 0.12, arrowFromX: 0.82, arrowFromY: 0.18, label: "right shoulder", confidence: 0.9 } }] }],
        coachingCues: [], setContext: { cameraView: "down-front diagonal", visibleReferences: ["shoulders", "handle endpoint"], sequenceSummary: "Three complete repetitions were visible.", changeAcrossSet: "The right shoulder rose first on the final two repetitions.", coachingBasis: "Keep both shoulders level through the same pull endpoint." }, setSummary: { totalReps: 3, consistentReps: 2, verdict: "One shoulder rises first." }, repTimeline: [{ repNumber: 1, startMs: 800, peakMs: 1_300, endMs: 1_800, assessment: "breakdown", note: "Right shoulder rises." }], nextSetPlan: [{ id: "plan", action: "Keep both shoulders level", rationale: "Pull evenly.", relatedFindingId: "shoulder" }], precisionRequest: { requestedRuns: 0, reason: null, targets: [] }, comparison: null,
      },
    }));
    const screen = await render(withSafeArea(<CoachScreen videos={[video("complete")]} initialSessionId="complete" loadAnalysis={loadAnalysis} />));

    await waitFor(() => expect(screen.getByLabelText("Full exercise recording")).toBeTruthy());
    expect(screen.getByText("FORM Coach")).toBeTruthy();
    expect(screen.getByTestId("coach-evidence-context")).toBeTruthy();
    expect(screen.getByTestId("coach-evidence-context").props.accessibilityLabel).toContain("Level the shoulders");
    expect(screen.getByText("ANALYSIS CONTEXT")).toBeTruthy();
    expect(screen.getByText("WHOLE-SET CONTEXT")).toBeTruthy();
    expect(screen.getByText("The right shoulder rose first on the final two repetitions.")).toBeTruthy();
    expect(screen.getByText("Check my form")).toBeTruthy();
    expect(screen.getByText("Am I hitting my target muscle?")).toBeTruthy();
    await fireEvent.press(screen.getByText("What should I change next set?"));
    expect(screen.getByLabelText("Message your coach").props.value).toBe("What should I change next set?");
  });

  it("requires a completed video before showing a composer", async () => {
    const screen = await render(withSafeArea(<CoachScreen videos={[video("complete"), video("processing", "processing")]} />));
    expect(screen.getByText("Choose a video to ask your coach")).toBeTruthy();
    expect(screen.getByLabelText("Analyzed video selector").props.horizontal).toBe(true);
    expect(screen.getByText("Cable row")).toBeTruthy();
    expect(screen.queryByText("Analyzing set")).toBeNull();
    expect(screen.queryByLabelText("Message your coach")).toBeNull();
  });

  it("preselects a result, supports optional intent, and sends optimistically", async () => {
    const sendMessage = jest.fn(async ({ message }: { message: string }) => ({
      threadId: "thread",
      userMessage: { id: "user-saved", threadId: "thread", role: "user" as const, content: message, createdAt: "now" },
      assistantMessage: { id: "assistant", threadId: "thread", role: "assistant" as const, content: "At 00:01, keep both shoulders level.", createdAt: "now" },
    }));
    const screen = await render(withSafeArea(<CoachScreen videos={[video("complete")]} initialSessionId="complete" loadConversation={async () => ({ thread: null, messages: [] })} sendMessage={sendMessage} />));
    expect(screen.getByText("Change")).toBeTruthy();
    expect(screen.getByLabelText("Message your coach")).toBeTruthy();
    await fireEvent.press(screen.getByText("Target · Add"));
    await fireEvent.changeText(screen.getByLabelText("Target muscle or area"), "upper back");
    await fireEvent.changeText(screen.getByLabelText("Message your coach"), "Are my shoulders level?");
    await fireEvent.press(screen.getByText("Send"));
    expect(screen.getByText("Are my shoulders level?")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("At 00:01, keep both shoulders level.")).toBeTruthy());
    expect(screen.getByTestId("coach-message-assistant")).toBeTruthy();
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "complete", targetIntent: "upper back" }));
  });

  it("keeps a failed draft and offers retry", async () => {
    const sendMessage = jest.fn().mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce({ threadId: "thread", userMessage: { id: "u", threadId: "thread", role: "user", content: "Help", createdAt: "now" }, assistantMessage: { id: "a", threadId: "thread", role: "assistant", content: "Try this", createdAt: "now" } });
    const screen = await render(withSafeArea(<CoachScreen videos={[video("complete")]} initialSessionId="complete" sendMessage={sendMessage} />));
    await fireEvent.changeText(screen.getByLabelText("Message your coach"), "Help");
    await fireEvent.press(screen.getByText("Send"));
    await waitFor(() => expect(screen.getByText("Retry")).toBeTruthy());
    expect(screen.getByLabelText("Message your coach").props.value).toBe("Help");
    await fireEvent.press(screen.getByText("Retry"));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2));
  });
});
