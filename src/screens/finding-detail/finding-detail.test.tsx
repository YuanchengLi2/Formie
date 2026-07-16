import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import type { CoachingFinding } from "@/features/analysis/result-schema";

import { FindingDetailScreen } from ".";

const finding: CoachingFinding = {
  id: "elbow-path",
  title: "Keep the pull smooth",
  detail: "Your right elbow accelerated ahead of the left during rep 3.",
  whyItMatters: "A smoother pull makes the repetitions more repeatable.",
  correction: "Reduce the load slightly and match both elbows.",
  cue: "Pull both handles through the same finish line.",
  severity: "important",
  evidence: [{ startMs: 7_200, peakMs: 7_650, endMs: 8_100, repNumber: 3, phase: "concentric", visualEvidence: "The right elbow reaches the torso first.", coachingNote: "your right elbow reaches the finish before the left. Slow the pull and finish both handles together.", visibleBodyAreas: ["left elbow", "right elbow"], confidence: 0.89, focusRegion: { centerX: 0.58, centerY: 0.36, radius: 0.11, arrowFromX: 0.82, arrowFromY: 0.18, label: "right elbow", confidence: 0.91 } }],
};

describe("FindingDetailScreen", () => {
  it("explains what happened, why it matters, and what to change", async () => {
    const onRecordAnother = jest.fn();
    const screen = await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>
        <FindingDetailScreen finding={finding} videoUrl={null} onRecordAnother={onRecordAnother} />
      </SafeAreaProvider>,
    );
    expect(screen.getByText("Your right elbow accelerated ahead of the left during rep 3.")).toBeTruthy();
    expect(screen.getByText("A smoother pull makes the repetitions more repeatable.")).toBeTruthy();
    expect(screen.getByText("Reduce the load slightly and match both elbows.")).toBeTruthy();
    expect(screen.getByText("Pull both handles through the same finish line.")).toBeTruthy();
    expect(screen.getByText("At 0:07, your right elbow reaches the finish before the left. Slow the pull and finish both handles together.")).toBeTruthy();
    expect(screen.getByText("Rep 3 · concentric · 00:07.2–00:08.1")).toBeTruthy();
    await fireEvent.press(screen.getByText("Record Another Set"));
    expect(onRecordAnother).toHaveBeenCalledTimes(1);
  });

  it("uses Gemini's high-confidence visual target for deterministic zoom, circle, and arrow", async () => {
    const screen = await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>
        <FindingDetailScreen
          finding={finding}
          videoUrl="https://storage.example/evidence.mp4"
          onRecordAnother={jest.fn()}
        />
      </SafeAreaProvider>,
    );

    expect(screen.getByText("LOOK HERE")).toBeTruthy();
    expect(screen.getByLabelText("AI focus: right elbow")).toBeTruthy();
    expect(screen.getByLabelText("Focus arrow to right elbow")).toBeTruthy();
  });
});
