import { fireEvent, render } from "@testing-library/react-native";

import { RecordingTipsScreen } from "./index";

describe("RecordingTipsScreen", () => {
  it("shows forgiving phone-placement guidance", async () => {
    const screen = await render(<RecordingTipsScreen onContinue={jest.fn()} onOpenSpaceHelp={jest.fn()} />);

    expect(screen.getByText("Set up your camera.")).toBeTruthy();
    expect(screen.queryByText(
      "Front, side, back, low, and high views are all okay. Keep the complete movement and exercise-critical areas clear and undistorted.",
    )).toBeNull();
    expect(screen.getByText(
      "Front, side, back, low, or high: keep the complete movement clear and undistorted",
    )).toBeTruthy();
    expect(screen.queryByText(/Use the rear camera for better quality/)).toBeNull();
    expect(screen.getByText("Use 0.5x if space is limited")).toBeTruthy();
    expect(screen.getByText("Keep the working joints, equipment, and support in frame")).toBeTruthy();
    expect(screen.getByLabelText("Animated phone placement guide")).toBeTruthy();
    expect(screen.getByTestId("recording-tips-motion-card")).toBeTruthy();
    expect(screen.getAllByTestId(/recording-tip-row-/)).toHaveLength(4);
    expect(screen.queryByLabelText("Phone placement from the production mockup")).toBeNull();
    expect(screen.queryByText(/recording|record your|video upload|private video/i)).toBeNull();
    expect(screen.queryByText(/squat|curl|press/i)).toBeNull();
  });

  it("opens space help and continues to the camera", async () => {
    const onContinue = jest.fn();
    const onOpenSpaceHelp = jest.fn();
    const screen = await render(<RecordingTipsScreen onContinue={onContinue} onOpenSpaceHelp={onOpenSpaceHelp} />);

    await fireEvent.press(screen.getByText(/No good place for your phone/));
    await fireEvent.press(screen.getByText("Continue to Camera"));

    expect(onOpenSpaceHelp).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
