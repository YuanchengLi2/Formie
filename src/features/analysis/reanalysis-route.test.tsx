import { fireEvent, render } from "@testing-library/react-native";

import ResultsRoute from "@/app/results/[session-id]";
import type { SetDeclaration } from "./set-declaration";

const mockMutate = jest.fn();
const mockSetDeclarationProps = jest.fn();
const mockFindDeviceVideo = jest.fn();
const mockDeclaration: SetDeclaration = {
  exercise: { source: "catalog", catalogExerciseId: 3, label: "Dumbbell Bench Press" },
  amount: { kind: "reps", value: 8, countScope: "total" },
  load: { kind: "known", value: 40, unit: "lb", scope: "per_hand" },
  side: "bilateral",
  styles: [],
  focusNote: null,
};

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ "session-id": "session-1" }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock("@tanstack/react-query", () => ({
  useMutation: () => ({
    mutate: mockMutate,
    isPending: false,
    error: null,
  }),
}));
jest.mock("@/features/auth/access-token", () => ({ getAccessToken: jest.fn() }));
jest.mock("@/features/progress/history-cache", () => ({ invalidateAnalysisHistory: jest.fn() }));
jest.mock("@/lib/query-client", () => ({
  queryClient: {
    cancelQueries: jest.fn(),
    removeQueries: jest.fn(),
  },
}));
jest.mock("@/features/analysis/use-analysis-status", () => ({
  useAnalysisStatus: () => ({
    data: {
      sessionId: "session-1",
      status: "complete",
      stage: "coaching",
      durationMs: 12_000,
      videoUrl: null,
      setDeclaration: mockDeclaration,
      result: {
        status: "complete",
        recognition: { label: "Dumbbell Bench Press" },
        setSummary: { totalReps: 8 },
        setDeclaration: mockDeclaration,
      },
    },
  }),
}));
jest.mock("@/features/capture/device-video-store", () => ({
  deviceVideoStore: {
    find: (...args: unknown[]) => mockFindDeviceVideo(...args),
  },
}));
jest.mock("@/features/analysis/use-exercise-tutorial", () => ({
  useExerciseTutorial: () => ({ isPending: false, data: null, refetch: jest.fn() }),
}));
jest.mock("@/features/capture/capture-store", () => ({
  useCaptureStore: () => jest.fn(),
}));
jest.mock("@/screens/results", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    ResultsScreen: ({ onReanalyze }: { onReanalyze: () => void }) => (
      <Pressable accessibilityRole="button" onPress={onReanalyze}>
        <Text>Analyze Again</Text>
      </Pressable>
    ),
  };
});
jest.mock("@/screens/set-declaration", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    SetDeclarationScreen: ({
      initialDeclaration,
      localVideoUri,
      showSide,
      analyzeLabel,
      secondaryLabel,
      onAnalyze,
      onRetake,
    }: {
      initialDeclaration: SetDeclaration | null;
      localVideoUri: string;
      showSide?: boolean;
      analyzeLabel?: string;
      secondaryLabel?: string;
      onAnalyze: (declaration: SetDeclaration) => void;
      onRetake: () => void;
    }) => {
      mockSetDeclarationProps({ showSide, localVideoUri });
      return <View>
        <Text>{initialDeclaration?.exercise.label ?? "No declaration"}</Text>
        <Pressable onPress={() => onAnalyze(mockDeclaration)}><Text>{analyzeLabel}</Text></Pressable>
        <Pressable onPress={onRetake}><Text>{secondaryLabel}</Text></Pressable>
      </View>;
    },
  };
});

describe("ResultsRoute reanalysis confirmation", () => {
  beforeEach(() => {
    mockMutate.mockClear();
    mockSetDeclarationProps.mockClear();
    mockFindDeviceVideo.mockReset();
    mockFindDeviceVideo.mockResolvedValue({
      localUri: "file:///formie-recordings/saved-set.mp4",
      durationMs: 12_000,
      mimeType: "video/mp4",
    });
  });

  it("opens the prefilled declaration form before every reanalysis", async () => {
    const screen = await render(<ResultsRoute />);

    await fireEvent.press(screen.getByText("Analyze Again"));
    await screen.findByText("Dumbbell Bench Press");

    expect(screen.getByText("Dumbbell Bench Press")).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
    expect(mockFindDeviceVideo).toHaveBeenCalledWith("session-1");
    expect(mockSetDeclarationProps).toHaveBeenLastCalledWith({
      showSide: false,
      localVideoUri: "file:///formie-recordings/saved-set.mp4",
    });
    expect(mockMutate).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText("Analyze Again"));
    await screen.findByText("Dumbbell Bench Press");
    expect(mockMutate).toHaveBeenCalledWith(mockDeclaration);
  });

  it("cancels confirmation without starting reanalysis", async () => {
    const screen = await render(<ResultsRoute />);

    await fireEvent.press(screen.getByText("Analyze Again"));
    await fireEvent.press(screen.getByText("Cancel"));

    expect(screen.getByText("Analyze Again")).toBeTruthy();
    expect(mockMutate).not.toHaveBeenCalled();
  });
});
