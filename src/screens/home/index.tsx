import { Pressable, ScrollView, Text, View } from "react-native";

import { FormWordmark } from "@/components/form-wordmark";
import { findExercise } from "@/features/exercises/catalog";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

import { ExerciseRow } from "./exercise-row";

const CATEGORIES = ["All", "Chest", "Back", "Legs", "Shoulders", "Arms", "Core"] as const;
const RECENT = [findExercise("barbell-bench-press"), findExercise("back-squat")].filter((item) => item !== undefined);

type HomeScreenProps = {
  onOpenSearch: () => void;
  onSelectExercise: (slug: string) => void;
};

export function HomeScreen({ onOpenSearch, onSelectExercise }: HomeScreenProps) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ gap: spacing.xl, paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, paddingBottom: 120 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <FormWordmark />
        <View style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, borderWidth: 1, borderColor: colors.border }}>
          <Text selectable style={{ color: colors.text, fontSize: 15 }}>♢</Text>
        </View>
      </View>
      <View style={{ gap: spacing.sm }}>
        <Text selectable style={[typography.title, { color: colors.text, maxWidth: 280 }]}>
          Ready to improve today?
        </Text>
      </View>
      <Pressable
        accessibilityRole="search"
        onPress={onOpenSearch}
        style={({ pressed }) => ({
          height: 52,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          borderRadius: radii.md,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
        })}
      >
        <Text selectable style={{ color: colors.text, fontSize: 18 }}>⌕</Text>
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>Search exercises</Text>
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {CATEGORIES.map((category, index) => (
          <View
            key={category}
            style={{
              paddingHorizontal: 13,
              paddingVertical: 7,
              borderRadius: radii.pill,
              borderWidth: 1,
              borderColor: index === 0 ? colors.gold : colors.border,
              backgroundColor: index === 0 ? colors.gold : colors.surface,
            }}
          >
            <Text selectable style={[typography.caption, { color: index === 0 ? colors.background : colors.textSecondary }]}>{category}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text selectable style={[typography.heading, { color: colors.text }]}>Recent Exercises</Text>
          <Pressable onPress={onOpenSearch}><Text selectable style={[typography.caption, { color: colors.gold }]}>View all</Text></Pressable>
        </View>
        {RECENT.map((exercise) => (
          <ExerciseRow key={exercise.slug} exercise={exercise} onPress={() => onSelectExercise(exercise.slug)} />
        ))}
      </View>
    </ScrollView>
  );
}
