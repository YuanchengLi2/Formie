/* eslint-disable @typescript-eslint/no-require-imports, import/first -- Jest mock factories load platform modules lazily. */
import { act, fireEvent, render } from "@testing-library/react-native";

const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
}));

jest.mock("expo-camera", () => {
  const { View } = require("react-native");
  return {
    CameraView: View,
    useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
  };
});

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: "success" },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("react-native-gesture-handler", () => {
  const { View } = require("react-native");
  const pinch = { runOnJS: () => pinch, onBegin: () => pinch, onUpdate: () => pinch };
  return { Gesture: { Pinch: () => pinch }, GestureDetector: View };
});

jest.mock("@/features/capture/analysis-upload-coordinator", () => ({
  analysisUploadCoordinator: {
    prepare: jest.fn(async () => null),
    reset: jest.fn(),
  },
}));

import { analysisUploadCoordinator } from "@/features/capture/analysis-upload-coordinator";
import { useCapturePreferences } from "@/features/capture/capture-preferences";
import { useCaptureStore } from "@/features/capture/capture-store";
import * as Haptics from "expo-haptics";
import { CameraScreen } from "./index";

describe("CameraScreen capture lifecycle", () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockBack.mockClear();
    mockReplace.mockClear();
    (analysisUploadCoordinator.reset as jest.Mock).mockClear();
    useCaptureStore.getState().dispatch({ type: "reset" });
    useCaptureStore.getState().dispatch({
      type: "exercise_customized",
      canonicalName: "Goblet Squat",
    });
    useCapturePreferences.setState({ preferences: { countdownSeconds: 10, hapticsEnabled: true }, hydrated: true });
  });

  it("starts from the selected countdown with a haptic-only cue", async () => {
    jest.useFakeTimers();
    useCapturePreferences.setState({ preferences: { countdownSeconds: 5, hapticsEnabled: true }, hydrated: true });
    const screen = await render(<CameraScreen />);

    await fireEvent.press(screen.getByLabelText("Start countdown"));
    expect(screen.getByText("5")).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(5_000);
    });

    expect(Haptics.notificationAsync).toHaveBeenCalledWith("success");
  });

  it("abandons the prepared upload target when the camera closes", async () => {
    const screen = await render(<CameraScreen />);

    expect(screen.queryByLabelText("FORM")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Close camera"));

    expect(analysisUploadCoordinator.reset).toHaveBeenCalledTimes(1);
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/recording-tips",
      params: {},
    });
  });

  it("lets the camera X cancel an active recording and return to Recording Tips", async () => {
    useCaptureStore.getState().dispatch({
      type: "begin_countdown",
      countdownSeconds: 5,
    });
    for (let tick = 0; tick < 5; tick += 1) {
      useCaptureStore.getState().dispatch({ type: "countdown_tick" });
    }
    useCaptureStore.getState().dispatch({ type: "recording_started", startedAt: Date.now() });
    const screen = await render(<CameraScreen />);
    const close = screen.getByLabelText("Close camera");

    expect(close.props.accessibilityState).toEqual({ disabled: false });
    await fireEvent.press(close);

    expect(useCaptureStore.getState().phase).toBe("idle");
    expect(useCaptureStore.getState().exerciseChoice).toEqual({
      kind: "custom",
      canonicalName: "Goblet Squat",
    });
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/recording-tips",
      params: {},
    });
  });

  it("uses the available ultrawide lens when 0.5x is selected", async () => {
    const screen = await render(<CameraScreen />);
    const preview = screen.getByLabelText("Camera preview");

    await act(async () => preview.props.onAvailableLensesChanged({ lenses: ["wideAngleCamera", "ultraWideCamera"] }));
    await fireEvent.press(screen.getByLabelText("Camera zoom 0.5x"));
    await act(async () => screen.getByLabelText("Camera preview").props.onAvailableLensesChanged({ lenses: ["wideAngleCamera", "ultraWideCamera"] }));

    expect(screen.getByLabelText("Camera preview").props.selectedLens).toBe("ultraWideCamera");
    expect(screen.getByLabelText("Camera zoom 0.5x").props.accessibilityState).toEqual({ selected: true });
  });
});
