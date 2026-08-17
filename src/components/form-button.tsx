import { Text, type StyleProp, type ViewStyle } from "react-native";

import { HapticPressable } from "@/components/haptic-pressable";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

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
  const palette = {
    primary: { backgroundColor: colors.gold, borderColor: colors.gold, color: colors.background },
    secondary: { backgroundColor: colors.surface, borderColor: colors.gold, color: colors.gold },
    ghost: { backgroundColor: "transparent", borderColor: "transparent", color: colors.gold },
  }[variant];

  return (
    <HapticPressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
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
    </HapticPressable>
  );
}
