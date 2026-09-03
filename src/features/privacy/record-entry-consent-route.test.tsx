/* eslint-disable import/first */
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockPush = jest.fn();
const mockCurrentConsent = jest.fn();
const mockAcceptConsent = jest.fn();
const mockIsCurrentConsent = jest.fn();

jest.mock("expo-router", () => {
  const ReactModule = jest.requireActual("react") as typeof React;
  const Native = jest.requireActual("react-native") as typeof import("react-native");
  const Tabs = ({ children }: { children: React.ReactNode }) => ReactModule.createElement(Native.View, null, children);
  function MockTabScreen({ name, options }: { name: string; options: { tabBarButton?: () => React.ReactNode } }) {
    return (
    name === "(record)" && options.tabBarButton
      ? ReactModule.createElement(Native.View, null, options.tabBarButton())
      : null
    );
  }
  Tabs.Screen = MockTabScreen;
  return { Tabs, useRouter: () => ({ push: mockPush }) };
});

jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));
jest.mock("@/components/center-tab-button", () => {
  const ReactModule = jest.requireActual("react") as typeof React;
  const Native = jest.requireActual("react-native") as typeof import("react-native");
  return {
    CenterTabButton: ({ accessibilityLabel, onPress }: { accessibilityLabel: string; onPress: () => void }) => ReactModule.createElement(
      Native.Pressable,
      { accessibilityRole: "button", accessibilityLabel, onPress },
      ReactModule.createElement(Native.Text, null, accessibilityLabel),
    ),
  };
});
jest.mock("@/components/haptic-pressable", () => {
  const Native = jest.requireActual("react-native") as typeof import("react-native");
  return { HapticPressable: Native.Pressable, triggerInteractionHaptic: jest.fn() };
});
jest.mock("@/components/coach-tab-icon", () => ({ CoachTabIcon: () => null }));
jest.mock("@/components/production-icon", () => ({ ProductionIcon: () => null }));
jest.mock("@/features/access/access-provider", () => ({
  useAccess: () => ({ status: "ready", access: { lifecycleState: "active_renewing", remaining: 3, pendingAnalysisSessionId: null }, refresh: jest.fn() }),
}));
jest.mock("@/features/access/account-access", () => ({
  analysisEntryHref: () => "/exercise-selection",
  formatAnalysisEntryLabel: () => "Record",
  resolveAnalysisEntry: () => "record",
}));
jest.mock("@/features/privacy/ai-consent", () => ({
  AI_PROCESSING_NOTICE: "Formie sends your exercise video to the paid Google Gemini API.",
  currentAiProcessingConsent: (...args: unknown[]) => mockCurrentConsent(...args),
  acceptAiProcessingConsent: (...args: unknown[]) => mockAcceptConsent(...args),
  isCurrentAiProcessingConsent: (...args: unknown[]) => mockIsCurrentConsent(...args),
}));
jest.mock("@/lib/supabase", () => ({ supabase: { rpc: jest.fn() } }));

import TabsLayout from "@/app/(tabs)/_layout";

describe("record entry AI consent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentConsent.mockResolvedValue(null);
    mockIsCurrentConsent.mockReturnValue(false);
    mockAcceptConsent.mockResolvedValue(undefined);
  });

  it("asks an existing account before recording and continues only after consent is saved", async () => {
    const screen = await render(<TabsLayout />);

    await fireEvent.press(screen.getByRole("button", { name: "Record" }));
    expect(await screen.findByText("Enable AI form analysis")).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole("button", { name: "Agree and continue" }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/exercise-selection"));
    expect(mockAcceptConsent).toHaveBeenCalledTimes(1);
  });

  it("opens recording immediately when current consent already exists", async () => {
    mockCurrentConsent.mockResolvedValue({ version: "current" });
    mockIsCurrentConsent.mockReturnValue(true);
    const screen = await render(<TabsLayout />);

    await fireEvent.press(screen.getByRole("button", { name: "Record" }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/exercise-selection"));
    expect(screen.queryByText("Enable AI form analysis")).toBeNull();
  });
});
