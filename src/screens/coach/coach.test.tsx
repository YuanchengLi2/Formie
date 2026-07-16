import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import type { AnalysisHistoryItem } from "@/features/progress/group-sessions";

import { CoachScreen } from ".";

const video = (sessionId: string, status: AnalysisHistoryItem["status"] = "complete"): AnalysisHistoryItem => ({ sessionId, status, createdAt: "2026-07-16T10:00:00Z", detectedLabel: "Cable row", correctedLabel: null, exerciseFamily: "row", score: 82, priorityCorrectionTitles: [], comparisonSummary: null, priorityIssueImproved: null });
const withSafeArea = (children: React.ReactNode) => <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>{children}</SafeAreaProvider>;

describe("CoachScreen", () => {
  it("requires a completed video before showing a composer", async () => {
    const screen = await render(withSafeArea(<CoachScreen videos={[video("complete"), video("processing", "processing")]} />));
    expect(screen.getByText("Choose a video to ask your coach")).toBeTruthy();
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
    expect(screen.getByText("Change Video")).toBeTruthy();
    expect(screen.getByLabelText("Message your coach")).toBeTruthy();
    await fireEvent.press(screen.getByText("What are you trying to target?"));
    await fireEvent.changeText(screen.getByLabelText("Target muscle or area"), "upper back");
    await fireEvent.changeText(screen.getByLabelText("Message your coach"), "Are my shoulders level?");
    await fireEvent.press(screen.getByText("Send"));
    expect(screen.getByText("Are my shoulders level?")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("At 00:01, keep both shoulders level.")).toBeTruthy());
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
