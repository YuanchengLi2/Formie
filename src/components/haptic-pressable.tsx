import * as Haptics from "expo-haptics";
import { forwardRef, type ElementRef } from "react";
import { Pressable as NativePressable, type GestureResponderEvent, type PressableProps } from "react-native";

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

type HapticPressableProps = PressableProps & {
  /** Pressability's continuous move callback is omitted from older RN type definitions. */
  onPressMove?: (event: GestureResponderEvent) => void;
};

export const HapticPressable = forwardRef<ElementRef<typeof NativePressable>, HapticPressableProps>(function HapticPressable({ onPress, onPressMove, accessibilityRole, ...props }, ref) {
  const nativeProps = { ...props, ...(onPressMove ? { onPressMove } : {}) } as PressableProps;
  return <NativePressable
    ref={ref}
    {...nativeProps}
    accessibilityRole={accessibilityRole}
    onPress={onPress ? (event) => {
      triggerInteractionHaptic(accessibilityRole);
      onPress(event);
    } : undefined}
  />;
});
