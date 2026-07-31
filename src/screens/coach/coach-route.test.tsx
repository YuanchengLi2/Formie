import { render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import CoachRoute from "@/app/(tabs)/(coach)";

const mockCoachApi = {
  createCoachThread: jest.fn(),
  deleteCoachThread: jest.fn(),
  getCoachConversation: jest.fn(),
  listCoachThreads: jest.fn(),
  renameCoachThread: jest.fn(),
  sendCoachMessage: jest.fn(),
};
jest.mock("@/features/analysis/api", () => ({ getAnalysisStatus: jest.fn() }));
jest.mock("@/features/auth/access-token", () => ({ getAccessToken: jest.fn() }));
jest.mock("@/features/coach/api", () => mockCoachApi);
jest.mock("@/features/progress/use-analysis-history", () => ({ useAnalysisHistory: () => ({ data: [] }) }));
jest.mock("@/screens/coach", () => {
  const { Text: MockText } = jest.requireActual("react-native");
  return { CoachScreen: () => <MockText>Live coach mounted</MockText> };
});

describe("CoachRoute", () => {
  it("keeps Coach on a neutral blurred construction workspace", async () => {
    const screen = await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>
        <CoachRoute />
      </SafeAreaProvider>,
    );

    expect(screen.queryByText("Live coach mounted")).toBeNull();
    expect(screen.getByText("Under Construction")).toBeTruthy();
    expect(screen.queryByText("Coming Soon")).toBeNull();
    expect(screen.getByTestId("coach-coming-soon-background", { includeHiddenElements: true }).props.pointerEvents).toBe("none");
    for (const api of Object.values(mockCoachApi)) expect(api).not.toHaveBeenCalled();
  });

  it("keeps the preview non-interactive without payment UI", async () => {
    const screen = await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>
        <CoachRoute />
      </SafeAreaProvider>,
    );
    expect(screen.getByText("Under Construction")).toBeTruthy();
    expect(screen.queryByText("Coming Soon")).toBeNull();
    expect(screen.getByTestId("coach-coming-soon-background", { includeHiddenElements: true }).props.pointerEvents).toBe("none");
    expect(screen.queryByText("Upgrade")).toBeNull();
  });
});
