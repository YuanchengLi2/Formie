import * as Haptics from "expo-haptics";
import { forwardRef, type ElementRef } from "react";
import { Pressable as NativePressable, type PressableProps } from "react-native";

import { useCapturePreferences } from "@/features/capture/capture-preferences";

const selectionRoles = new Set(["tab", "radio", "checkbox", "switch"]);

export function triggerInteractionHaptic(role: PressableProps["accessibilityRole"] = "button", force = false) {
  if (process.env.EXPO_OS === "web" || (!force && !useCapturePreferences.getState().preferences.interactionHapticsEnabled)) return;
  const feedback = selectionRoles.has(role ?? "") && typeof Haptics.selectionAsync === "function"
    ? Haptics.selectionAsync()
    : typeof Haptics.impactAsync === "function"
      ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      : null;
  void feedback?.catch(() => undefined);
}

export const HapticPressable = forwardRef<ElementRef<typeof NativePressable>, PressableProps>(function HapticPressable({ onPress, accessibilityRole, ...props }, ref) {
  return <NativePressable
    ref={ref}
    {...props}
    accessibilityRole={accessibilityRole}
    onPress={onPress ? (event) => {
      triggerInteractionHaptic(accessibilityRole);
      onPress(event);
    } : undefined}
  />;
});
