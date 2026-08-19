import { fireEvent, render } from "@testing-library/react-native";

import { CameraControls } from "./camera-controls";

describe("CameraControls", () => {
  it("shows the ten-second preparation countdown", async () => {
    const screen = await render(
      <CameraControls phase="countingDown" countdown={10} elapsedMs={0} error={null} hasRecording={false} onRecord={jest.fn()} onStop={jest.fn()} onRetryUpload={jest.fn()} />,
    );
    expect(screen.getByText("10")).toBeTruthy();
    expect(screen.getByText("Recording starts automatically")).toBeTruthy();
  });

  it("shows elapsed time and stops an active set", async () => {
    const onStop = jest.fn();
    const screen = await render(
      <CameraControls phase="recording" countdown={null} elapsedMs={61_000} error={null} hasRecording={false} onRecord={jest.fn()} onStop={onStop} onRetryUpload={jest.fn()} />,
    );
    expect(screen.getByText("01:01")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Stop recording"));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("does not stop before the backend minimum recording duration", async () => {
    const onStop = jest.fn();
    const screen = await render(
      <CameraControls phase="recording" countdown={null} elapsedMs={2_000} error={null} hasRecording={false} onRecord={jest.fn()} onStop={onStop} onRetryUpload={jest.fn()} />,
    );
    expect(screen.getByText("Keep recording for 3 seconds")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Stop recording"));
    expect(onStop).not.toHaveBeenCalled();
  });

  it("can start a fresh recording after a previous analysis begins processing", async () => {
    const onRecord = jest.fn();
    const screen = await render(
      <CameraControls phase="processing" countdown={null} elapsedMs={0} error={null} hasRecording onRecord={onRecord} onStop={jest.fn()} onRetryUpload={jest.fn()} />,
    );
    await fireEvent.press(screen.getByLabelText("Start countdown"));
    expect(onRecord).toHaveBeenCalledTimes(1);
  });

  it("offers a clear way to return to the full unzoomed view", async () => {
    const onResetZoom = jest.fn();
    const screen = await render(
      <CameraControls phase="idle" countdown={null} elapsedMs={0} error={null} hasRecording={false} zoomed onResetZoom={onResetZoom} onRecord={jest.fn()} onStop={jest.fn()} onRetryUpload={jest.fn()} />,
    );
    expect(screen.queryByText(/pinch to zoom/i)).toBeNull();
    await fireEvent.press(screen.getByLabelText("Reset zoom to 1x"));
    expect(onResetZoom).toHaveBeenCalledTimes(1);
  });

  it("shows persistent camera lens presets and selects one", async () => {
    const onSelectZoom = jest.fn();
    const screen = await render(
      <CameraControls
        phase="idle"
        countdown={null}
        elapsedMs={0}
        error={null}
        hasRecording={false}
        zoomPresets={["0.5x", "1x", "2x"]}
        activeZoomLabel="1x"
        onSelectZoom={onSelectZoom}
        onRecord={jest.fn()}
        onStop={jest.fn()}
        onRetryUpload={jest.fn()}
      />,
    );
    expect(screen.getByLabelText("Camera zoom 0.5x")).toBeTruthy();
    expect(screen.getByLabelText("Camera zoom 1x").props.accessibilityState).toEqual({ selected: true });
    await fireEvent.press(screen.getByLabelText("Camera zoom 2x"));
    expect(onSelectZoom).toHaveBeenCalledWith("2x");
  });

  it("keeps a retry action visible when upload fails", async () => {
    const onRetryUpload = jest.fn();
    const onDiscardRecording = jest.fn();
    const screen = await render(
      <CameraControls
        phase="error"
        countdown={null}
        elapsedMs={0}
        error="Connection lost"
        hasRecording
        onRecord={jest.fn()}
        onStop={jest.fn()}
        onRetryUpload={onRetryUpload}
        onDiscardRecording={onDiscardRecording}
      />,
    );
    expect(screen.getByText("Connection lost")).toBeTruthy();
    await fireEvent.press(screen.getByText("Retry Upload"));
    await fireEvent.press(screen.getByText("Discard and Record Again"));
    expect(onRetryUpload).toHaveBeenCalledTimes(1);
    expect(onDiscardRecording).toHaveBeenCalledTimes(1);
  });

  it("offers a new recording when the camera never saved a local file", async () => {
    const onRecord = jest.fn();
    const screen = await render(
      <CameraControls phase="error" countdown={null} elapsedMs={0} error="Camera stopped" hasRecording={false} onRecord={onRecord} onStop={jest.fn()} onRetryUpload={jest.fn()} />,
    );
    await fireEvent.press(screen.getByText("Record Again"));
    expect(onRecord).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Your recording is still saved on this device.")).toBeNull();
  });
});
