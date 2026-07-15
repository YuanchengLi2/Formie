import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { searchExercises } from "@/features/exercises/search";
import type { ExerciseCategory } from "@/features/exercises/types";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

import { ExerciseRow } from "../home/exercise-row";

const CATEGORY_OPTIONS: Array<"All" | ExerciseCategory> = ["All", "Chest", "Back", "Legs", "Shoulders", "Arms", "Core"];

type ExerciseSearchScreenProps = {
  onSelect: (slug: string) => void;
};

export function ExerciseSearchScreen({ onSelect }: ExerciseSearchScreenProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"All" | ExerciseCategory>("All");
  const exercises = useMemo(
    () => searchExercises(query, category === "All" ? undefined : category),
    [category, query],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md }}>
        <TextInput
          accessibilityLabel="Search exercises"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Search exercises"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          selectionColor={colors.gold}
          style={{
            height: 48,
            paddingHorizontal: spacing.lg,
            borderRadius: radii.md,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            color: colors.text,
            fontSize: 16,
          }}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {CATEGORY_OPTIONS.map((option) => {
            const selected = option === category;
            return (
              <Pressable
                key={option}
                onPress={() => setCategory(option)}
                style={{
                  paddingHorizontal: 13,
                  paddingVertical: 7,
                  borderRadius: radii.pill,
                  borderWidth: 1,
                  borderColor: selected ? colors.gold : colors.border,
                  backgroundColor: selected ? colors.gold : colors.surface,
                }}
              >
                <Text selectable style={[typography.caption, { color: selected ? colors.background : colors.textSecondary }]}>{option}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        data={exercises}
        keyExtractor={(item) => item.slug}
        contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: 80 }}
        renderItem={({ item }) => <ExerciseRow compact exercise={item} onPress={() => onSelect(item.slug)} />}
        ListEmptyComponent={<Text selectable style={[typography.body, { color: colors.textSecondary, paddingTop: spacing.xl }]}>No exercises found.</Text>}
      />
    </View>
  );
}
