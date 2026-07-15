import { ScrollView, Text, View } from "react-native";

import { FormButton } from "@/components/form-button";
import type { Exercise } from "@/features/exercises/types";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

type ExerciseDetailScreenProps = {
  exercise: Exercise;
  onContinue: () => void;
  onChooseAnother: () => void;
};

export function ExerciseDetailScreen({ exercise, onContinue, onChooseAnother }: ExerciseDetailScreenProps) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ flexGrow: 1, gap: spacing.xl, padding: spacing.lg, paddingBottom: spacing.xxl }}
    >
      <View style={{ alignItems: "center", gap: spacing.xs }}>
        <Text selectable style={[typography.heading, { color: colors.text, textAlign: "center" }]}>{exercise.name}</Text>
        <Text selectable style={[typography.caption, { color: colors.textSecondary }]}>Movement Demo</Text>
      </View>
      <View
        style={{
          flex: 1,
          minHeight: 360,
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.xl,
          borderRadius: radii.lg,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          overflow: "hidden",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.xxl }}>
          <Text selectable style={{ color: colors.textSecondary, fontSize: 112, fontWeight: "200" }}>♙</Text>
          <Text selectable style={{ color: colors.gold, fontSize: 62 }}>↗</Text>
          <Text selectable style={{ color: colors.textMuted, fontSize: 112, fontWeight: "200", opacity: 0.5 }}>♙</Text>
        </View>
        <Text selectable style={[typography.body, { color: colors.text, textAlign: "center", paddingHorizontal: spacing.xl }]}>
          Controlled. {exercise.profile.attentionAreas[0]} steady.
        </Text>
      </View>
      <View style={{ gap: spacing.sm }}>
        <FormButton label="This Is My Exercise" onPress={onContinue} />
        <FormButton label="Choose Another Variation" onPress={onChooseAnother} variant="ghost" />
      </View>
    </ScrollView>
  );
}
