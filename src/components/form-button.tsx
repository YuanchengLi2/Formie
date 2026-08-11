import * as Haptics from "expo-haptics";
import { Pressable, Text, type StyleProp, type ViewStyle } from "react-native";

import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";
import { useCapturePreferences } from "@/features/capture/capture-preferences";

type FormButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function FormButton({
  label,
  onPress,
  disabled = false,
  variant = "primary",
  style,
  testID,
}: FormButtonProps) {
  const handlePress = () => {
    if (process.env.EXPO_OS === "ios" && useCapturePreferences.getState().preferences.interactionHapticsEnabled) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const palette = {
    primary: { backgroundColor: colors.gold, borderColor: colors.gold, color: colors.background },
    secondary: { backgroundColor: colors.surface, borderColor: colors.gold, color: colors.gold },
    ghost: { backgroundColor: "transparent", borderColor: "transparent", color: colors.gold },
  }[variant];

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={handlePress}
      testID={testID}
      style={({ pressed }) => [
        {
          minHeight: 54,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderRadius: radii.md,
          borderCurve: "continuous",
          paddingHorizontal: spacing.xl,
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
          opacity: disabled ? 0.42 : pressed ? 0.86 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      <Text selectable style={[typography.label, { color: palette.color }]}>
        {label}
      </Text>
    </Pressable>
  );
}
