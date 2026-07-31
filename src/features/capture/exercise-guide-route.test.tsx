/* eslint-disable @typescript-eslint/no-require-imports, import/first */
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockGetExerciseGuide = jest.fn();
const mockFindPersistedGuide = jest.fn();
const mockSavePersistedGuide = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockParams: { previousSessionId?: string; flow?: "rejected" | "review" } = {};

jest.mock("expo-router", () => {
  const { Text: MockText } = require("react-native");
  return {
    Redirect: ({ href }: { href: string }) => <MockText>{`redirect:${href}`}</MockText>,
    useLocalSearchParams: () => mockParams,
    useRouter: () => ({ push: mockPush, replace: mockReplace }),
  };
});

jest.mock("@/features/analysis/api", () => ({
  getExerciseGuide: (...args: unknown[]) => mockGetExerciseGuide(...args),
}));

jest.mock("@/features/auth/access-token", () => ({
  getAccessToken: jest.fn(async () => "user-jwt"),
}));

jest.mock("@/features/capture/exercise-guide-store", () => ({
  exerciseGuideStore: {
    find: (...args: unknown[]) => mockFindPersistedGuide(...args),
    save: (...args: unknown[]) => mockSavePersistedGuide(...args),
  },
}));

jest.mock("@/screens/exercise-guide", () => {
  const { Pressable: MockPressable, Text: MockText } = require("react-native");
  return {
    ExerciseGuideScreen: ({
      guide,
      loading,
      onContinue,
    }: {
      guide: { exercise: { canonicalName: string } } | null;
      loading: boolean;
      onContinue: () => void;
    }) => (
      <>
        <MockText>{loading ? "guide-loading" : "guide-idle"}</MockText>
        {guide ? <MockText>{`guide:${guide.exercise.canonicalName}`}</MockText> : null}
        <MockPressable accessibilityLabel="Continue to Camera Tips" onPress={onContinue} />
      </>
    ),
  };
});

import ExerciseGuideRoute from "@/app/exercise-guide";
import { useCaptureStore } from "@/features/capture/capture-store";

const guide = {
  exercise: { catalogExerciseId: 88, canonicalName: "One-Arm Dumbbell Row", family: "row" as const },
  setup: ["Brace one hand on a stable bench."],
  execution: ["Drive the working elbow toward your hip."],
  safety: ["Keep the supporting surface from sliding."],
  cameraPlacement: ["Keep the working shoulder, elbow, wrist, torso, dumbbell, and bench visible."],
  tutorial: null,
};

describe("ExerciseGuideRoute", () => {
  beforeEach(() => {
    mockParams = {};
    mockGetExerciseGuide.mockReset();
    mockFindPersistedGuide.mockReset();
    mockFindPersistedGuide.mockResolvedValue(null);
    mockSavePersistedGuide.mockReset();
    mockSavePersistedGuide.mockResolvedValue(undefined);
    mockPush.mockClear();
    mockReplace.mockClear();
    useCaptureStore.getState().dispatch({ type: "reset" });
    useCaptureStore.getState().dispatch({
      type: "exercise_selected",
      exercise: {
        catalogExerciseId: 88,
        canonicalName: "One-Arm Dumbbell Row",
        mechanics: { laterality: "unilateral" },
      },
    });
  });

  it("loads a setup guide once and reuses it when the setup screen is revisited", async () => {
    mockGetExerciseGuide.mockResolvedValue(guide);
    const first = await render(<ExerciseGuideRoute />);
    await waitFor(() => expect(first.getByText("guide:One-Arm Dumbbell Row")).toBeTruthy());
    await first.unmount();

    const second = await render(<ExerciseGuideRoute />);
    expect(second.getByText("guide:One-Arm Dumbbell Row")).toBeTruthy();
    expect(mockGetExerciseGuide).toHaveBeenCalledTimes(1);
    expect(mockSavePersistedGuide).toHaveBeenCalledWith("catalog:88", guide);
  });

  it("reloads a generated guide from device storage without another AI request", async () => {
    mockFindPersistedGuide.mockResolvedValue(guide);

    const screen = await render(<ExerciseGuideRoute />);

    await waitFor(() => expect(screen.getByText("guide:One-Arm Dumbbell Row")).toBeTruthy());
    expect(mockGetExerciseGuide).not.toHaveBeenCalled();
    expect(useCaptureStore.getState()).toMatchObject({
      exerciseGuideKey: "catalog:88",
      exerciseGuide: guide,
    });
  });

  it("continues to Recording Tips without stacking another capture route", async () => {
    mockGetExerciseGuide.mockResolvedValue(guide);
    const screen = await render(<ExerciseGuideRoute />);
    await waitFor(() => expect(screen.getByText("guide:One-Arm Dumbbell Row")).toBeTruthy());

    await fireEvent.press(screen.getByLabelText("Continue to Camera Tips"));

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/recording-tips",
      params: {},
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("continues through camera tips and discards a rejected recording only when retaking", async () => {
    useCaptureStore.setState({
      phase: "recorded",
      recording: { localUri: "file:///set.mp4", durationMs: 8_000, mimeType: "video/mp4" },
      exerciseGuide: guide,
      exerciseGuideKey: "catalog:88",
    });
    mockParams = { previousSessionId: "session-1", flow: "rejected" };
    const screen = await render(<ExerciseGuideRoute />);

    await fireEvent.press(screen.getByLabelText("Continue to Camera Tips"));

    expect(useCaptureStore.getState().recording).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/recording-tips",
      params: { previousSessionId: "session-1" },
    });
    expect(mockGetExerciseGuide).not.toHaveBeenCalled();
  });

  it("returns from the guide to Set Details when it was opened from clip review", async () => {
    mockParams = { flow: "review" };
    const screen = await render(<ExerciseGuideRoute />);

    await fireEvent.press(screen.getByLabelText("Continue to Camera Tips"));

    expect(mockReplace).toHaveBeenCalledWith("/analysis/set-details");
    expect(mockPush).not.toHaveBeenCalled();
  });
});
