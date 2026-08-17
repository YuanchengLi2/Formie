import { fireEvent, render } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { Text } from "react-native";

import { useCapturePreferences } from "@/features/capture/capture-preferences";
import { HapticPressable, triggerInteractionHaptic } from "./haptic-pressable";

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "light" },
}));

describe("HapticPressable", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_OS = "ios";
    useCapturePreferences.setState({ preferences: { countdownSeconds: 10, recordingVibrationEnabled: true, interactionHapticsEnabled: true }, hydrated: true });
  });

  it("adds impact feedback to a normal action before invoking it", async () => {
    const onPress = jest.fn();
    const screen = await render(<HapticPressable accessibilityRole="button" onPress={onPress}><Text>Save</Text></HapticPressable>);

    await fireEvent.press(screen.getByText("Save"));

    expect(Haptics.impactAsync).toHaveBeenCalledWith("light");
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("uses selection feedback for tabs and respects the preference", async () => {
    const screen = await render(<HapticPressable accessibilityRole="tab" onPress={jest.fn()}><Text>Form</Text></HapticPressable>);
    await fireEvent.press(screen.getByText("Form"));
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);

    useCapturePreferences.setState({ preferences: { countdownSeconds: 10, recordingVibrationEnabled: true, interactionHapticsEnabled: false }, hydrated: true });
    await fireEvent.press(screen.getByText("Form"));
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);

    triggerInteractionHaptic("switch", true);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(2);
  });

  it("does not vibrate or invoke disabled actions", async () => {
    const onPress = jest.fn();
    const screen = await render(<HapticPressable disabled onPress={onPress}><Text>Disabled</Text></HapticPressable>);
    await fireEvent.press(screen.getByText("Disabled"));
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
  });
});
