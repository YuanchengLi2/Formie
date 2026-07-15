import { Pressable, Text, View } from "react-native";

import type { Exercise } from "@/features/exercises/types";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

type ExerciseRowProps = {
  exercise: Exercise;
  onPress: () => void;
  compact?: boolean;
};

export function ExerciseRow({ exercise, onPress, compact = false }: ExerciseRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Choose ${exercise.name}`}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: compact ? 66 : 78,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.md,
        borderCurve: "continuous",
        backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
      })}
    >
      <View
        style={{
          width: compact ? 42 : 50,
          height: compact ? 42 : 50,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radii.sm,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text selectable style={{ color: colors.textSecondary, fontSize: compact ? 18 : 22 }}>
          ◇
        </Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text selectable numberOfLines={1} style={[typography.label, { color: colors.text }]}>
          {exercise.name}
        </Text>
        <Text selectable style={[typography.caption, { color: colors.textSecondary }]}>
          {exercise.category}
        </Text>
      </View>
      <Text selectable style={{ color: colors.textSecondary, fontSize: 24, fontWeight: "300" }}>
        ›
      </Text>
    </Pressable>
  );
}
