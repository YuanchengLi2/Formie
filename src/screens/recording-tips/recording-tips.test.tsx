import { fireEvent, render } from "@testing-library/react-native";

import { RecordingTipsScreen } from "./index";

describe("RecordingTipsScreen", () => {
  it("shows forgiving phone-placement guidance", async () => {
    const screen = await render(<RecordingTipsScreen onContinue={jest.fn()} onOpenSpaceHelp={jest.fn()} />);

    expect(screen.getByText("Place your phone anywhere stable")).toBeTruthy();
    expect(screen.getByText("Use the rear camera for better quality")).toBeTruthy();
    expect(screen.getByText("Use 0.5x if space is limited")).toBeTruthy();
    expect(screen.getByText("The angle does not need to be perfect. Just keep yourself and the movement visible.")).toBeTruthy();
    expect(screen.getByText("On a bench")).toBeTruthy();
    expect(screen.getByText("Against a water bottle or gym bag")).toBeTruthy();
    expect(screen.getByText("On a small phone tripod")).toBeTruthy();
    expect(screen.getByLabelText("General phone placement animation")).toBeTruthy();
    expect(screen.getByText("By continuing, you consent to securely upload this exercise video for AI form analysis.")).toBeTruthy();
    expect(screen.queryByText(/squat|curl|press/i)).toBeNull();
  });

  it("opens space help and continues to the camera", async () => {
    const onContinue = jest.fn();
    const onOpenSpaceHelp = jest.fn();
    const screen = await render(<RecordingTipsScreen onContinue={onContinue} onOpenSpaceHelp={onOpenSpaceHelp} />);

    await fireEvent.press(screen.getByText("No good place for your phone?"));
    await fireEvent.press(screen.getByText("Continue to Camera"));

    expect(onOpenSpaceHelp).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
