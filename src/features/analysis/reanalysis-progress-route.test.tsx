import { fireEvent, render, waitFor } from "@testing-library/react-native";

import AnalysisProgressRoute from "@/app/analysis/[session-id]";
import type { SetDeclaration } from "./set-declaration";

const mockDispatch = jest.fn();
const mockReplace = jest.fn();
const mockFindDeviceVideo = jest.fn();
const mockReanalyzeAnalysis = jest.fn();
const mockRefetch = jest.fn();
const mockSetDeclarationProps = jest.fn();
const declaration: SetDeclaration = {
  exercise: { source: "custom", catalogExerciseId: null, label: "Dumbbell Skull Crusher" },
  amount: { kind: "reps", value: 10, countScope: "total" },
  load: { kind: "known", value: 20, unit: "lb", scope: "per_hand" },
  side: "bilateral",
  styles: ["slow_tempo"],
  focusNote: null,
};

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ "session-id": "session-1" }),
  useRouter: () => ({ replace: mockReplace }),
}));
jest.mock("@tanstack/react-query", () => ({
  useMutation: (options: { mutationFn: () => Promise<unknown>; onSuccess?: () => void }) => {
    return {
    mutate: () => {
      void options.mutationFn().then(() => options.onSuccess?.());
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
  useAnalysisStatus: () => ({
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
  }),
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
  });

  it("reuploads the device-local video instead of resetting a missing server video", async () => {
    const screen = await render(<AnalysisProgressRoute />);

    expect(screen.getByText("Formie couldn't finish this analysis. Your recording is still saved.")).toBeTruthy();
    expect(mockSetDeclarationProps).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Retry Analysis"));

    await waitFor(() => expect(mockFindDeviceVideo).toHaveBeenCalledWith("session-1"));
    expect(mockDispatch).toHaveBeenNthCalledWith(1, {
      type: "local_reanalysis_prepared",
      recording: {
        localUri: "file:///formie-recordings/session-1.mp4",
        durationMs: 12_000,
        mimeType: "video/mp4",
      },
      declaration,
      previousSessionId: "session-1",
    });
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/analysis/review");
    expect(mockReanalyzeAnalysis).not.toHaveBeenCalled();
    expect(mockRefetch).not.toHaveBeenCalled();
  });
});
