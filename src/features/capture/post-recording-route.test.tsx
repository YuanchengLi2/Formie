/* eslint-disable @typescript-eslint/no-require-imports, import/first */
import { act, fireEvent, render } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { BackHandler } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock("expo-router", () => {
  const { Text: MockText } = require("react-native");
  return {
  Redirect: ({ href }: { href: string }) => <MockText>{`redirect:${href}`}</MockText>,
  useFocusEffect: (effect: () => void | (() => void)) => {
    const React = require("react");
    React.useEffect(effect, [effect]);
  },
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  };
});

jest.mock("@/screens/camera", () => {
  const { Text: MockText } = require("react-native");
  return { CameraScreen: () => <MockText>camera-screen</MockText> };
});

jest.mock("@/screens/recording-tips", () => {
  const { Pressable: MockPressable, Text: MockText } = require("react-native");
  return {
    RecordingTipsScreen: ({ onContinue }: { onContinue: () => void }) => (
      <>
        <MockText>recording-tips-screen</MockText>
        <MockPressable accessibilityLabel="Continue from recording tips" onPress={onContinue} />
      </>
    ),
  };
});

jest.mock("@/screens/set-declaration", () => {
  const { Pressable: MockPressable, Text: MockText } = require("react-native");
  return {
    SetDeclarationScreen: ({
      onAnalyze,
      showVideoPreview,
    }: {
      onAnalyze: (declaration: unknown) => void;
      showVideoPreview?: boolean;
    }) => (
      <>
        <MockText>set-details-screen</MockText>
        <MockText>{`show-video:${String(showVideoPreview)}`}</MockText>
        <MockPressable
          accessibilityLabel="Submit mocked set details"
          onPress={() => onAnalyze({
            exercise: { source: "custom", catalogExerciseId: null, label: "Squat" },
            amount: { kind: "reps", value: 5, countScope: "total" },
            load: { kind: "bodyweight" },
            side: null,
            styles: [],
            focusNote: null,
          })}
        >
          <MockText>Submit mocked set details</MockText>
        </MockPressable>
      </>
    ),
  };
});

jest.mock("expo-video", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View: MockView } = require("react-native");
  const MockVideoView = React.forwardRef((props: Record<string, unknown>, ref: React.ForwardedRef<unknown>) => {
    React.useImperativeHandle(ref, () => ({ enterFullscreen: jest.fn() }));
    return <MockView {...props} />;
  });
  MockVideoView.displayName = "MockVideoView";
  return {
    useVideoPlayer: (_source: string, setup?: (player: Record<string, unknown>) => void) => {
      const playerRef = React.useRef<Record<string, unknown> | null>(null);
      if (!playerRef.current) {
        const player = {
          addListener: jest.fn(() => ({ remove: jest.fn() })),
          currentTime: 0,
          duration: 18,
          loop: false,
          pause: jest.fn(),
          play: jest.fn(),
          playing: false,
          status: "readyToPlay",
          timeUpdateEventInterval: 0,
        };
        setup?.(player);
        playerRef.current = player;
      }
      return playerRef.current;
    },
    VideoView: MockVideoView,
  };
});

jest.mock("@/features/access/access-provider", () => ({
  useAccess: () => ({ access: { remaining: 10 } }),
}));

jest.mock("@/features/analysis/exercise-catalog", () => ({
  searchExerciseCatalog: jest.fn(),
}));

jest.mock("@/features/capture/analysis-upload-coordinator", () => ({
  analysisUploadCoordinator: { reset: jest.fn() },
}));

import CameraRoute from "@/app/camera";
import RecordingTipsRoute from "@/app/recording-tips";
import AnalysisReviewRoute from "@/app/analysis/review";
import AnalysisSetDetailsRoute from "@/app/analysis/set-details";
import { useCaptureStore } from "@/features/capture/capture-store";

const recording = {
  localUri: "file:///set.mp4",
  durationMs: 8_000,
  mimeType: "video/mp4",
};

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
};

function renderRoute(route: ReactElement) {
  return render(<SafeAreaProvider initialMetrics={safeAreaMetrics}>{route}</SafeAreaProvider>);
}

describe("post-recording route invariants", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockPush.mockClear();
    useCaptureStore.getState().dispatch({ type: "reset" });
  });

  it("never renders the camera's preparing-upload state for a retained recording", async () => {
    useCaptureStore.setState({
      phase: "recorded",
      recording,
      exerciseChoice: {
        kind: "selected",
        catalogExerciseId: 4,
        canonicalName: "Goblet Squat",
        mechanics: {},
      },
    });
    const screen = await renderRoute(<CameraRoute />);

    expect(screen.getByText("redirect:/analysis/review")).toBeTruthy();
    expect(screen.queryByText("camera-screen")).toBeNull();
  });

  it.each([
    ["camera", () => <CameraRoute />, "camera-screen"],
    ["camera tips", () => <RecordingTipsRoute />, "recording-tips-screen"],
  ])("redirects %s to exercise selection when no exercise is selected", async (_name, createRoute, screenText) => {
    const screen = await renderRoute(createRoute());

    expect(screen.getByText("redirect:/exercise-selection")).toBeTruthy();
    expect(screen.queryByText(screenText)).toBeNull();
  });

  it("returns from clip review to Recording Tips without exposing stale history", async () => {
    const addEventListener = jest.spyOn(BackHandler, "addEventListener");
    useCaptureStore.setState({ phase: "recorded", recording });
    await renderRoute(<AnalysisReviewRoute />);

    expect(addEventListener).toHaveBeenCalledWith("hardwareBackPress", expect.any(Function));
    const handler = addEventListener.mock.calls[0]?.[1];
    let handled = false;
    await act(async () => { handled = handler?.() ?? false; });
    expect(handled).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/recording-tips",
      params: {},
    });
    expect(useCaptureStore.getState().recording).toBeNull();
    addEventListener.mockRestore();
  });

  it("continues from Recording Tips by replacing the route instead of stacking another page", async () => {
    useCaptureStore.setState({
      exerciseChoice: {
        kind: "selected",
        catalogExerciseId: 4,
        canonicalName: "Goblet Squat",
        mechanics: {},
      },
    });
    const screen = await renderRoute(<RecordingTipsRoute />);

    await fireEvent.press(screen.getByLabelText("Continue from recording tips"));

    expect(mockReplace).toHaveBeenCalledWith({ pathname: "/camera", params: {} });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("renders the reference clip review with the authoritative projected quota", async () => {
    useCaptureStore.setState({
      phase: "recorded",
      recording,
      exerciseChoice: {
        kind: "selected",
        catalogExerciseId: 4,
        canonicalName: "Goblet Squat",
        mechanics: {},
      },
    });
    const screen = await renderRoute(<AnalysisReviewRoute />);

    expect(screen.getByText("Check your recording")).toBeTruthy();
    expect(screen.queryByLabelText("Recorded set preview")).toBeNull();
    expect(screen.getByText("1 analysis will be used")).toBeTruthy();
    expect(screen.getByText(/10 available now/)).toBeTruthy();
    expect(screen.getByText("Whole body visible")).toBeTruthy();
    expect(screen.getByText("Stable and not shaky")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Video tab"));
    expect(screen.getByLabelText("Recorded set preview")).toBeTruthy();
    expect(screen.queryByText("FINAL CHECK")).toBeNull();
    expect(screen.queryByText(/Formie can only analyze what the camera clearly shows/)).toBeNull();
    expect(screen.queryByText("set-details-screen")).toBeNull();

    await fireEvent.press(screen.getByLabelText("Continue"));

    expect(mockReplace).toHaveBeenCalledWith("/analysis/set-details");
    expect(useCaptureStore.getState().phase).toBe("recorded");
  });

  it("uses the visible review back control as the same discard-and-retake action", async () => {
    useCaptureStore.setState({ phase: "recorded", recording });
    const screen = await renderRoute(<AnalysisReviewRoute />);

    await fireEvent.press(screen.getByLabelText("Go back from Check Recording"));

    expect(useCaptureStore.getState().recording).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith({ pathname: "/recording-tips", params: {} });
  });

  it("renders Set Details on its own route without duplicating clip review", async () => {
    useCaptureStore.setState({
      phase: "recorded",
      recording,
      exerciseChoice: {
        kind: "selected",
        catalogExerciseId: 4,
        canonicalName: "Goblet Squat",
        mechanics: {},
      },
    });
    const screen = await renderRoute(<AnalysisSetDetailsRoute />);

    expect(screen.getByText("set-details-screen")).toBeTruthy();
    expect(screen.getByText("show-video:false")).toBeTruthy();
    expect(screen.queryByText("FINAL CHECK")).toBeNull();

    await fireEvent.press(screen.getByLabelText("Submit mocked set details"));
    expect(useCaptureStore.getState().phase).toBe("uploading");
    expect(mockReplace).toHaveBeenCalledWith("/analysis/upload");
  });

  it("returns from Set Details directly to Clip Review", async () => {
    const addEventListener = jest.spyOn(BackHandler, "addEventListener");
    useCaptureStore.setState({ phase: "recorded", recording });
    await renderRoute(<AnalysisSetDetailsRoute />);

    const handler = addEventListener.mock.calls.at(-1)?.[1];
    expect(handler?.()).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith("/analysis/review");
    expect(useCaptureStore.getState().recording).toEqual(recording);
    addEventListener.mockRestore();
  });

  it("renders a recovered recording without a post-recording camera verdict", async () => {
    useCaptureStore.getState().dispatch({
      type: "local_reanalysis_prepared",
      recording,
      declaration: {
        exercise: { source: "custom", catalogExerciseId: null, label: "One Arm Incline Dumbbell Row" },
        amount: { kind: "reps", value: 3, countScope: "per_side" },
        load: { kind: "known", value: 50, unit: "lb", scope: "per_hand" },
        side: "right",
        styles: [],
        focusNote: null,
      },
      previousSessionId: "session-1",
    });

    const screen = await renderRoute(<AnalysisReviewRoute />);

    expect(screen.getByText("Check your recording")).toBeTruthy();
    expect(screen.queryByText("6 things to check")).toBeNull();
    expect(screen.queryByText("set-details-screen")).toBeNull();
  });
});
