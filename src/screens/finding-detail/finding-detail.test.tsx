import { render } from "@testing-library/react-native";
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
  evidence: [{ startMs: 7_200, endMs: 8_100, repNumber: 3, phase: "concentric", visualEvidence: "The right elbow reaches the torso first.", mediaPipeEvidence: "Right elbow leads by 140 ms.", observableLandmarks: ["left_elbow", "right_elbow"], confidence: 0.89 }],
};

describe("FindingDetailScreen", () => {
  it("explains what happened, why it matters, and what to change", async () => {
    const screen = await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>
        <FindingDetailScreen finding={finding} videoUrl={null} />
      </SafeAreaProvider>,
    );
    expect(screen.getByText("Your right elbow accelerated ahead of the left during rep 3.")).toBeTruthy();
    expect(screen.getByText("A smoother pull makes the repetitions more repeatable.")).toBeTruthy();
    expect(screen.getByText("Reduce the load slightly and match both elbows.")).toBeTruthy();
    expect(screen.getByText("Pull both handles through the same finish line.")).toBeTruthy();
    expect(screen.getByText("Rep 3 · concentric · 00:07.2–00:08.1")).toBeTruthy();
  });
});
