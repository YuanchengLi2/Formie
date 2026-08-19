import { fireEvent, render } from "@testing-library/react-native";

import { RecordingTipsScreen } from "./index";
import { RECORDING_CHECKS } from "@/features/capture/recording-checks";

describe("RecordingTipsScreen", () => {
  it("shows forgiving phone-placement guidance", async () => {
    const screen = await render(<RecordingTipsScreen onContinue={jest.fn()} onOpenSpaceHelp={jest.fn()} />);

    expect(screen.getByText("Set up your camera.")).toBeTruthy();
    expect(screen.getByText("Camera isn’t too far away.")).toBeTruthy();
    expect(screen.getByText("Whole body visible.")).toBeTruthy();
    expect(screen.queryByText(/Use the rear camera for better quality/)).toBeNull();
    expect(screen.getByText("Stable and not shaky.")).toBeTruthy();
    expect(screen.getByText("Nothing blocks your body.")).toBeTruthy();
    expect(screen.getByLabelText("Animated phone placement guide")).toBeTruthy();
    expect(screen.getByTestId("recording-tips-motion-card")).toBeTruthy();
    expect(screen.getAllByTestId(/recording-tip-row-/)).toHaveLength(6);
    expect(RECORDING_CHECKS).toEqual([
      "Camera isn’t too far away.",
      "Whole body visible.",
      "Whole movement visible.",
      "Stable and not shaky.",
      "Nothing blocks your body.",
      "Camera stays in the same position.",
    ]);
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
