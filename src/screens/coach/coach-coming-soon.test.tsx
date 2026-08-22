import { render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import type { AnalysisHistoryItem } from "@/features/progress/group-sessions";

import { CoachComingSoonScreen } from "./coach-coming-soon";

jest.mock("expo-blur", () => {
  const { View } = jest.requireActual("react-native");
  return { BlurView: View };
});

const video: AnalysisHistoryItem = {
  sessionId: "11111111-1111-4111-8111-111111111111",
  status: "complete",
  createdAt: "2026-07-22T10:00:00Z",
  detectedLabel: "Single-arm dumbbell row",
  correctedLabel: null,
  exerciseFamily: "row",
  score: 82,
  priorityCorrectionTitles: ["Keep torso square"],
  comparisonSummary: null,
  priorityIssueImproved: null,
};

describe("CoachComingSoonScreen", () => {
  it("keeps the recording picker inert behind a neutral blur with one construction label", async () => {
    const screen = await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>
        <CoachComingSoonScreen videos={[video]} />
      </SafeAreaProvider>,
    );

    expect(screen.getByText("Choose a set", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId("coach-coming-soon-background", { includeHiddenElements: true }).props).toMatchObject({
      accessibilityElementsHidden: true,
      importantForAccessibility: "no-hide-descendants",
      pointerEvents: "none",
    });
    expect(screen.getByTestId("coach-coming-soon-blur")).toHaveProp(
      "blurMethod",
      "dimezisBlurView",
    );
    expect(screen.getByTestId("coach-coming-soon-blur")).toHaveProp(
      "tint",
      "systemMaterialDark",
    );
    expect(screen.getByText("Under Construction")).toBeTruthy();
    expect(screen.queryByText("Coming Soon")).toBeNull();
    expect(screen.queryByText("Stay tuned for more.")).toBeNull();
    expect(screen.queryByTestId("coach-coming-soon-scrim")).toBeNull();
    expect(screen.queryByTestId("coach-coming-soon-card")).toBeNull();
  });
});
