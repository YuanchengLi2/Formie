import { fireEvent, render } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";

import { FormButton } from "./form-button";
import { useCapturePreferences } from "@/features/capture/capture-preferences";

jest.mock("expo-haptics", () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: "light" } }));

describe("FormButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_OS = "ios";
    useCapturePreferences.setState({ preferences: { countdownSeconds: 10, recordingVibrationEnabled: true, interactionHapticsEnabled: true }, hydrated: true });
  });
  it("invokes the primary action once", async () => {
    const onPress = jest.fn();
    const view = await render(<FormButton label="Record Set" onPress={onPress} />);
    await fireEvent.press(view.getByText("Record Set"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not invoke a disabled action", async () => {
    const onPress = jest.fn();
    const view = await render(<FormButton label="Begin Recording" onPress={onPress} disabled />);
    await fireEvent.press(view.getByText("Begin Recording"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("honors the interaction-haptics preference without disabling the action", async () => {
    useCapturePreferences.setState({ preferences: { countdownSeconds: 10, recordingVibrationEnabled: true, interactionHapticsEnabled: false }, hydrated: true });
    const onPress = jest.fn();
    const view = await render(<FormButton label="Continue" onPress={onPress} />);
    fireEvent.press(view.getByText("Continue"));
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
