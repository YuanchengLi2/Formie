import { fireEvent, render, waitFor } from "@testing-library/react-native";

import AnalysisProgressRoute from "@/app/analysis/[session-id]";
import type { SetDeclaration } from "./set-declaration";

const mockDispatch = jest.fn();
const mockReplace = jest.fn();
const mockFindDeviceVideo = jest.fn();
const mockReanalyzeAnalysis = jest.fn();
const mockRefetch = jest.fn();
const mockSetDeclarationProps = jest.fn();
let mockConsentCurrent = true;
const declaration: SetDeclaration = {
  exercise: { source: "custom", catalogExerciseId: null, label: "Dumbbell Skull Crusher" },
  amount: { kind: "reps", value: 10, countScope: "total" },
  load: { kind: "known", value: 20, unit: "lb", scope: "per_hand" },
  side: "bilateral",
  styles: ["slow_tempo"],
  focusNote: null,
};
const mockStatus: {
  data: {
    sessionId: string;
    status: string;
    stage: string;
    failureCode: string | null;
    durationMs: number;
    videoUrl: string | null;
    setDeclaration: SetDeclaration | null;
    result: Record<string, unknown> | null;
  };
  error: null;
  refetch: typeof mockRefetch;
} = {
  data: {
    sessionId: "session-1",
    status: "failed",
    stage: "video_check",
    failureCode: "DECLARED_CONTEXT_MISMATCH",
    durationMs: 12_000,
    videoUrl: "https://storage.example/saved.mp4",
    setDeclaration: declaration,
    result: null,
  },
  error: null,
  refetch: mockRefetch,
};
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ "session-id": "session-1" }),
  useRouter: () => ({ replace: mockReplace }),
}));
jest.mock("@tanstack/react-query", () => ({
  useMutation: (options: { mutationFn: () => Promise<unknown>; onSuccess?: (value: unknown) => void }) => {
    return {
    mutate: () => {
      void options.mutationFn().then((value) => options.onSuccess?.(value));
    },
    isPending: false,
    error: null,
  };
  },
}));
jest.mock("@/features/analysis/api", () => ({
  AnalysisApiError: class AnalysisApiError extends Error {},
  reanalyzeAnalysis: (...args: unknown[]) => mockReanalyzeAnalysis(...args),
}));
jest.mock("@/features/auth/access-token", () => ({ getAccessToken: jest.fn(async () => "token") }));
jest.mock("@/features/privacy/ai-consent", () => ({
  currentAiProcessingConsent: jest.fn(async () => mockConsentCurrent ? ({ version: "current" }) : null),
  isCurrentAiProcessingConsent: (consent: unknown) => Boolean(consent),
  acceptAiProcessingConsent: jest.fn(async () => undefined),
}));
jest.mock("@/lib/supabase", () => ({ supabase: {} }));
jest.mock("@/features/progress/history-cache", () => ({ invalidateAnalysisHistory: jest.fn() }));
jest.mock("@/lib/query-client", () => ({
  queryClient: {
    removeQueries: jest.fn(),
  },
}));
jest.mock("@/features/capture/capture-store", () => ({
  useCaptureStore: () => mockDispatch,
}));
jest.mock("@/features/capture/device-video-store", () => ({
  deviceVideoStore: {
    find: (...args: unknown[]) => mockFindDeviceVideo(...args),
  },
}));
jest.mock("@/features/analysis/use-analysis-status", () => ({
  useAnalysisStatus: () => mockStatus,
}));
jest.mock("@/screens/analysis-progress", () => ({
  AnalysisProgressScreen: ({
    failureMessage,
    onRetryAnalysis,
  }: {
    failureMessage: string | null;
    onRetryAnalysis?: () => void;
  }) => {
    const { Pressable, Text, View } = jest.requireActual("react-native");
    return (
      <View>
        <Text>{failureMessage}</Text>
        {onRetryAnalysis ? <Pressable onPress={onRetryAnalysis}><Text>Retry Analysis</Text></Pressable> : null}
      </View>
    );
  },
}));
jest.mock("@/screens/set-declaration", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    SetDeclarationScreen: ({
      initialDeclaration,
      showSide,
      onAnalyze,
    }: {
      initialDeclaration: SetDeclaration | null;
      showSide?: boolean;
      onAnalyze: (value: SetDeclaration) => void;
    }) => {
      mockSetDeclarationProps({ initialDeclaration, showSide });
      return (
        <View>
          <Text>{initialDeclaration?.exercise.label}</Text>
          <Pressable onPress={() => onAnalyze(declaration)}>
            <Text>Analyze Again</Text>
          </Pressable>
        </View>
      );
    },
  };
});

describe("AnalysisProgressRoute declaration authority", () => {
  beforeEach(() => {
    mockDispatch.mockClear();
    mockReplace.mockClear();
    mockFindDeviceVideo.mockReset();
    mockFindDeviceVideo.mockResolvedValue({
      localUri: "file:///formie-recordings/session-1.mp4",
      durationMs: 12_000,
      mimeType: "video/mp4",
    });
    mockReanalyzeAnalysis.mockClear();
    mockReanalyzeAnalysis.mockResolvedValue({ sessionId: "session-1", status: "queued", stage: "video_check" });
    mockRefetch.mockClear();
    mockRefetch.mockResolvedValue(undefined);
    mockSetDeclarationProps.mockClear();
    mockConsentCurrent = true;
    mockStatus.data = {
      sessionId: "session-1",
      status: "failed",
      stage: "video_check",
      failureCode: "DECLARED_CONTEXT_MISMATCH",
      durationMs: 12_000,
      videoUrl: "https://storage.example/saved.mp4",
      setDeclaration: declaration,
      result: null,
    };
  });

  it("resets the retained server video without uploading the device copy", async () => {
    const screen = await render(<AnalysisProgressRoute />);

    expect(screen.getByText("Formie couldn't finish this analysis. Your recording is still saved.")).toBeTruthy();
    expect(mockSetDeclarationProps).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Retry Analysis"));

    await waitFor(() => expect(mockReanalyzeAnalysis).toHaveBeenCalled());
    expect(mockReanalyzeAnalysis).toHaveBeenCalledWith(expect.objectContaining({
      accessToken: "token",
      sessionId: "session-1",
      declaration,
      clientRequestId: expect.any(String),
    }));
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/analysis/session-1");
    expect(mockFindDeviceVideo).not.toHaveBeenCalled();
    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it("does not navigate to results from a stale result while the session is still processing", async () => {
    mockStatus.data = {
      ...mockStatus.data,
      status: "processing",
      stage: "analyzing",
      failureCode: null,
      result: { status: "complete" },
    };

    await render(<AnalysisProgressRoute />);

    expect(mockReplace).not.toHaveBeenCalledWith("/results/session-1");
  });

  it("does not retry a failed analysis when AI consent is missing", async () => {
    mockConsentCurrent = false;
    const screen = await render(<AnalysisProgressRoute />);
    await fireEvent.press(screen.getByText("Retry Analysis"));
    expect(await screen.findByText("Enable AI form analysis")).toBeTruthy();
    expect(mockReanalyzeAnalysis).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Not now"));
    expect(mockReanalyzeAnalysis).not.toHaveBeenCalled();
  });

  it("navigates to results only when a terminal session has its result payload", async () => {
    mockStatus.data = {
      ...mockStatus.data,
      status: "complete",
      stage: "complete",
      failureCode: null,
      result: { status: "complete" },
    };

    await render(<AnalysisProgressRoute />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/results/session-1"));
  });

  it("surfaces a missing terminal result instead of leaving the analysis animation running", async () => {
    mockStatus.data = {
      ...mockStatus.data,
      status: "complete",
      stage: "complete",
      failureCode: null,
      result: null,
    };

    const screen = await render(<AnalysisProgressRoute />);

    expect(screen.getByText("Your analysis finished, but its result could not be loaded. Retry the analysis or record again.")).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalledWith("/results/session-1");
  });
});
