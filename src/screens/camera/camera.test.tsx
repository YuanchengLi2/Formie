/* eslint-disable @typescript-eslint/no-require-imports, import/first -- Jest mock factories load platform modules lazily. */
import { act, fireEvent, render } from "@testing-library/react-native";

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockGetAvailableLensesAsync = jest.fn<Promise<string[]>, []>();
const mockRecordAsync = jest.fn<Promise<{ uri: string }>, [Record<string, unknown>]>();
const mockStopRecording = jest.fn();
const mockPersistRecording = jest.fn();
let finishNativeRecording: ((result: { uri: string }) => void) | undefined;
let mockPinchBegin: (() => void) | undefined;
let mockPinchUpdate: ((event: { scale: number }) => void) | undefined;
let mockPinchEnd: ((event: { scale: number }) => void) | undefined;

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
}));

jest.mock("expo-camera", () => {
  const React = require("react");
  const { View } = require("react-native");
  const CameraView = React.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({
      getAvailableLensesAsync: mockGetAvailableLensesAsync,
      recordAsync: mockRecordAsync,
      stopRecording: mockStopRecording,
    }));
    return React.createElement(View, props);
  });
  CameraView.displayName = "CameraView";
  return {
    CameraView,
    useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
  };
});

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  NotificationFeedbackType: { Success: "success" },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("react-native-gesture-handler", () => {
  const { View } = require("react-native");
  const pinch = {
    runOnJS: () => pinch,
    onBegin: (callback: () => void) => { mockPinchBegin = callback; return pinch; },
    onUpdate: (callback: (event: { scale: number }) => void) => { mockPinchUpdate = callback; return pinch; },
    onFinalize: (callback: (event: { scale: number }) => void) => { mockPinchEnd = callback; return pinch; },
  };
  return { Gesture: { Pinch: () => pinch }, GestureDetector: View };
});

jest.mock("@/features/capture/analysis-upload-coordinator", () => ({
  analysisUploadCoordinator: {
    prepare: jest.fn(async () => null),
    reset: jest.fn(),
  },
}));

jest.mock("@/features/capture/device-video-store", () => ({
  deviceVideoStore: {
    persist: (...args: unknown[]) => mockPersistRecording(...args),
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
    mockGetAvailableLensesAsync.mockReset();
    mockRecordAsync.mockReset().mockImplementation(() => new Promise((resolve) => { finishNativeRecording = resolve; }));
    mockStopRecording.mockReset().mockImplementation(() => finishNativeRecording?.({ uri: "file:///captured.mp4" }));
    mockPersistRecording.mockReset().mockImplementation(async (recording) => recording);
    finishNativeRecording = undefined;
    mockPinchBegin = undefined;
    mockPinchUpdate = undefined;
    mockPinchEnd = undefined;
    (analysisUploadCoordinator.reset as jest.Mock).mockClear();
    useCaptureStore.getState().dispatch({ type: "reset" });
    useCaptureStore.getState().dispatch({
      type: "exercise_customized",
      canonicalName: "Goblet Squat",
    });
    useCapturePreferences.setState({ preferences: { countdownSeconds: 10, recordingVibrationEnabled: true, interactionHapticsEnabled: true }, hydrated: true });
    (Haptics.notificationAsync as jest.Mock).mockClear();
  });

  it("starts from the selected countdown with a haptic-only cue", async () => {
    jest.useFakeTimers();
    useCapturePreferences.setState({ preferences: { countdownSeconds: 5, recordingVibrationEnabled: true, interactionHapticsEnabled: true }, hydrated: true });
    const screen = await render(<CameraScreen />);

    await fireEvent.press(screen.getByLabelText("Start countdown"));
    expect(screen.getByText("5")).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(5_000);
    });

    expect(Haptics.notificationAsync).toHaveBeenCalledWith("success");
  });

  it("can disable only the recording-start vibration", async () => {
    jest.useFakeTimers();
    useCapturePreferences.setState({ preferences: { countdownSeconds: 5, recordingVibrationEnabled: false, interactionHapticsEnabled: true }, hydrated: true });
    const screen = await render(<CameraScreen />);
    await fireEvent.press(screen.getByLabelText("Start countdown"));
    await act(async () => { jest.advanceTimersByTime(5_000); });
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
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

  it("returns Reset to 1x to the wide physical lens after ultrawide use", async () => {
    const screen = await render(<CameraScreen />);
    const preview = screen.getByLabelText("Camera preview");
    await act(async () => preview.props.onAvailableLensesChanged({ lenses: ["wideAngleCamera", "ultraWideCamera"] }));
    await fireEvent.press(screen.getByLabelText("Camera zoom 0.5x"));
    expect(screen.getByLabelText("Camera preview").props.selectedLens).toBe("ultraWideCamera");
    await fireEvent.press(screen.getByLabelText("Reset zoom to 1x"));
    expect(screen.getByLabelText("Camera preview").props.selectedLens).toBe("wideAngleCamera");
    expect(screen.getByLabelText("Camera zoom 1x").props.accessibilityState).toEqual({ selected: true });
  });

  it("discovers the native ultrawide lens when the camera becomes ready", async () => {
    mockGetAvailableLensesAsync.mockResolvedValue(["builtInWideAngleCamera", "builtInUltraWideCamera"]);
    const screen = await render(<CameraScreen />);
    const preview = screen.getByLabelText("Camera preview");

    await act(async () => preview.props.onCameraReady());
    await fireEvent.press(screen.getByLabelText("Camera zoom 0.5x"));

    expect(screen.getByLabelText("Camera preview").props.selectedLens).toBe("builtInUltraWideCamera");
  });

  it("keeps the ultrawide lens when asynchronous discovery returns a partial snapshot", async () => {
    mockGetAvailableLensesAsync.mockResolvedValue(["wideAngleCamera"]);
    const screen = await render(<CameraScreen />);
    const preview = screen.getByLabelText("Camera preview");

    await act(async () => preview.props.onAvailableLensesChanged({ lenses: ["wideAngleCamera", "ultraWideCamera"] }));
    await act(async () => preview.props.onCameraReady());

    expect(screen.getByLabelText("Camera zoom 0.5x")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Camera zoom 0.5x"));
    expect(screen.getByLabelText("Camera preview").props.selectedLens).toBe("ultraWideCamera");
  });

  it("does not apply a stale rear-camera lens response after switching to the front camera", async () => {
    let resolveRearLenses: ((lenses: string[]) => void) | undefined;
    mockGetAvailableLensesAsync.mockReturnValue(new Promise((resolve) => { resolveRearLenses = resolve; }));
    const screen = await render(<CameraScreen />);

    screen.getByLabelText("Camera preview").props.onCameraReady();
    await fireEvent.press(screen.getByLabelText("Flip camera"));
    await act(async () => resolveRearLenses?.(["wideAngleCamera", "ultraWideCamera"]));

    expect(screen.queryByLabelText("Camera zoom 0.5x")).toBeNull();
  });

  it("restarts the native preview on flip and rejects stale native lens callbacks", async () => {
    const screen = await render(<CameraScreen />);
    const rearPreview = screen.getByLabelText("Camera preview");
    const staleNativeLensCallback = rearPreview.props.onAvailableLensesChanged;
    const rearNativeId = rearPreview.props.nativeID;

    await act(async () => staleNativeLensCallback({ lenses: ["wideAngleCamera", "ultraWideCamera"] }));
    await fireEvent.press(screen.getByLabelText("Toggle light"));
    await fireEvent.press(screen.getByLabelText("Camera zoom 0.5x"));
    await fireEvent.press(screen.getByLabelText("Flip camera"));

    const frontPreview = screen.getByLabelText("Camera preview");
    expect(frontPreview.props.facing).toBe("front");
    expect(frontPreview.props.nativeID).not.toBe(rearNativeId);
    expect(frontPreview.props.enableTorch).toBe(false);
    expect(frontPreview.props.selectedLens).toBeUndefined();

    await act(async () => staleNativeLensCallback({ lenses: ["wideAngleCamera", "ultraWideCamera"] }));
    expect(screen.queryByLabelText("Camera zoom 0.5x")).toBeNull();

    await act(async () => frontPreview.props.onAvailableLensesChanged({ lenses: ["frontCamera"] }));
    expect(screen.getByLabelText("Camera preview").props.facing).toBe("front");
  });

  it("finishes the native recording lifecycle and opens review when stop resolves", async () => {
    jest.useFakeTimers();
    useCapturePreferences.setState({ preferences: { countdownSeconds: 5, recordingVibrationEnabled: false, interactionHapticsEnabled: true }, hydrated: true });
    const screen = await render(<CameraScreen />);

    await fireEvent.press(screen.getByLabelText("Start countdown"));
    await act(async () => { jest.advanceTimersByTime(5_000); });
    expect(mockRecordAsync).toHaveBeenCalledTimes(1);

    await act(async () => { jest.advanceTimersByTime(3_000); });

    await fireEvent.press(screen.getByLabelText("Stop recording"));
    await act(async () => { await Promise.resolve(); });

    expect(mockStopRecording).toHaveBeenCalledTimes(1);
    expect(mockPersistRecording).toHaveBeenCalledWith(expect.objectContaining({ localUri: "file:///captured.mp4" }));
    expect(mockReplace).toHaveBeenCalledWith("/analysis/review");
    expect(useCaptureStore.getState().phase).toBe("recorded");
  });

  it("lets a pinch cross from 1x onto the ultrawide camera", async () => {
    const screen = await render(<CameraScreen />);
    await act(async () => screen.getByLabelText("Camera preview").props.onAvailableLensesChanged({ lenses: ["wideAngleCamera", "ultraWideCamera"] }));

    await act(async () => {
      mockPinchBegin?.();
      mockPinchUpdate?.({ scale: 0.5 });
      mockPinchEnd?.({ scale: 0.5 });
    });

    expect(screen.getByLabelText("Camera preview").props.selectedLens).toBe("ultraWideCamera");
    expect(screen.getByLabelText("Camera preview").props.zoom).toBeUndefined();
  });

  it("uses one compound camera for zooming out and back in", async () => {
    const screen = await render(<CameraScreen />);
    const preview = screen.getByLabelText("Camera preview");
    await act(async () => preview.props.onAvailableLensesChanged({ lenses: ["Back Wide Angle Camera", "Back Ultra Wide Camera", "Back Triple Camera"] }));

    await fireEvent.press(screen.getByLabelText("Camera zoom 0.5x"));
    expect(screen.getByLabelText("Camera preview").props.selectedLens).toBe("Back Triple Camera");

    await fireEvent.press(screen.getByLabelText("Camera zoom 2x"));
    expect(screen.getByLabelText("Camera preview").props.selectedLens).toBe("Back Triple Camera");

    await act(async () => {
      mockPinchBegin?.();
      mockPinchUpdate?.({ scale: 0.25 });
      mockPinchEnd?.({ scale: 0.25 });
    });
    expect(screen.getByLabelText("Camera preview").props.selectedLens).toBe("Back Triple Camera");
  });

  it("locks the physical lens during recording while keeping pinch zoom active", async () => {
    const screen = await render(<CameraScreen />);
    await act(async () => screen.getByLabelText("Camera preview").props.onAvailableLensesChanged({ lenses: ["wideAngleCamera", "ultraWideCamera"] }));
    expect(screen.getByLabelText("Camera preview").props.selectedLens).toBe("wideAngleCamera");

    await act(async () => {
      useCaptureStore.getState().dispatch({ type: "begin_countdown", countdownSeconds: 5 });
      for (let tick = 0; tick < 5; tick += 1) useCaptureStore.getState().dispatch({ type: "countdown_tick" });
      useCaptureStore.getState().dispatch({ type: "recording_started", startedAt: Date.now() });
    });
    await act(async () => {
      mockPinchBegin?.();
      mockPinchUpdate?.({ scale: 0.5 });
    });

    expect(screen.getByLabelText("Camera preview").props.selectedLens).toBe("wideAngleCamera");
    expect(screen.getByLabelText("Live camera magnification")).toBeTruthy();
    expect(screen.getByLabelText("Flip camera").props.accessibilityState).toEqual({ disabled: true });
    await act(async () => mockPinchEnd?.({ scale: 0.5 }));
  });

  it("has one authoritative zoom prop instead of competing React and animated values", async () => {
    const screen = await render(<CameraScreen />);
    expect(screen.getByLabelText("Camera preview").props.zoom).toBeUndefined();
    expect(screen.getByLabelText("Camera preview").props.animatedProps).toEqual(expect.objectContaining({ zoom: expect.any(Number) }));
  });

  it("does not offer 0.5x when the active camera has no ultrawide lens", async () => {
    mockGetAvailableLensesAsync.mockResolvedValue(["builtInWideAngleCamera"]);
    const screen = await render(<CameraScreen />);

    await act(async () => screen.getByLabelText("Camera preview").props.onCameraReady());

    expect(screen.queryByLabelText("Camera zoom 0.5x")).toBeNull();
    expect(screen.getByLabelText("Camera zoom 1x")).toBeTruthy();
  });

  it("keeps recording available when native lens discovery fails", async () => {
    mockGetAvailableLensesAsync.mockRejectedValue(new Error("Lens discovery unavailable"));
    const screen = await render(<CameraScreen />);

    await act(async () => screen.getByLabelText("Camera preview").props.onCameraReady());

    expect(screen.getByLabelText("Start countdown")).toBeTruthy();
  });

  it("renders the compact 720p AVC capture profile", async () => {
    const screen = await render(<CameraScreen />);
    const preview = screen.getByLabelText("Camera preview");

    expect(preview.props.videoQuality).toBe("720p");
    expect(preview.props.videoBitrate).toBe(2_750_000);
    expect(preview.props.mute).toBe(true);
  });
});
