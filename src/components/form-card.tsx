import type { PropsWithChildren } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";

type FormCardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

export function FormCard({ children, style }: FormCardProps) {
  return (
    <View
      style={[
        {
          gap: spacing.md,
          padding: spacing.lg,
          borderRadius: radii.md,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
