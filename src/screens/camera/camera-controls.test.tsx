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

  it("keeps a retry action visible when upload fails", async () => {
    const onRetryUpload = jest.fn();
    const screen = await render(
      <CameraControls phase="error" countdown={null} elapsedMs={0} error="Connection lost" hasRecording onRecord={jest.fn()} onStop={jest.fn()} onRetryUpload={onRetryUpload} />,
    );
    expect(screen.getByText("Connection lost")).toBeTruthy();
    await fireEvent.press(screen.getByText("Retry Upload"));
    expect(onRetryUpload).toHaveBeenCalledTimes(1);
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
