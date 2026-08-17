import { useEffect, useState } from "react";
import { ActivityIndicator, Keyboard, ScrollView, Text, TextInput, View } from "react-native";
import { HapticPressable as Pressable } from "@/components/haptic-pressable";
import { Image } from "expo-image";

import { ExerciseFamilyIcon } from "@/components/exercise-family-icon";
import type { CatalogExercise } from "@/features/analysis/exercise-catalog";
import { inferExerciseFamily, isExerciseFamily } from "@/features/exercises/exercise-family";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

type ExerciseSelectionScreenProps = {
  initialExercise?: CatalogExercise | null;
  onSearch: (query: string) => Promise<CatalogExercise[]>;
  onSelect: (exercise: CatalogExercise) => void;
  onGenerateCustomGuide: (exerciseName: string) => void;
};

const benchPressHero = require("../../../assets/production/choose-exercise-bench.png");

function normalizeExerciseMatch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function ExerciseSelectionScreen({
  initialExercise = null,
  onSearch,
  onSelect,
  onGenerateCustomGuide,
}: ExerciseSelectionScreenProps) {
  const [query, setQuery] = useState(initialExercise?.name ?? "");
  const [results, setResults] = useState<CatalogExercise[]>(initialExercise ? [initialExercise] : []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalizedQuery = query.trim();
  const searchIsActive = normalizedQuery.length >= 2;
  const exactMatchQuery = normalizeExerciseMatch(normalizedQuery);
  const hasExactCatalogMatch = results.some((exercise) => (
    [exercise.name, ...exercise.aliases]
      .some((candidate) => normalizeExerciseMatch(candidate) === exactMatchQuery)
  ));

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setResults(initialExercise && normalized === initialExercise.name ? [initialExercise] : []);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      void onSearch(normalized)
        .then((matches) => {
          if (active) setResults(matches);
        })
        .catch(() => {
          if (active) {
            setResults([]);
            setError("Exercises could not be loaded. Retry, or use the exercise name you entered.");
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 180);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [initialExercise, onSearch, query]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      onScrollBeginDrag={Keyboard.dismiss}
      testID="exercise-selection-scroll"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl }}
    >
      <TextInput
        testID="exercise-search"
        accessibilityLabel="Search exercises"
        autoCapitalize="words"
        autoCorrect={false}
        placeholder="Search exercises"
        placeholderTextColor={colors.textMuted}
        value={query}
        onChangeText={setQuery}
        style={[
          typography.body,
          {
            minHeight: 54,
            paddingHorizontal: spacing.md,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            color: colors.text,
          },
        ]}
      />

      {loading ? <ActivityIndicator accessibilityLabel="Searching exercises" color={colors.gold} /> : null}
      {error ? <Text accessibilityRole="alert" style={[typography.body, { color: colors.danger }]}>{error}</Text> : null}

      <View style={{ gap: spacing.sm }}>
        {results.map((exercise) => (
          <Pressable
            key={exercise.id}
            accessibilityLabel={`Select ${exercise.name}`}
            accessibilityRole="button"
            onPress={() => onSelect(exercise)}
            style={({ pressed }) => ({
              minHeight: 66,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: pressed ? colors.goldSoft : colors.surface,
            })}
          >
            <ExerciseFamilyIcon
              family={isExerciseFamily(exercise.family) ? exercise.family : inferExerciseFamily(exercise.name)}
              size={44}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[typography.heading, { color: colors.text }]}>{exercise.name}</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>{exercise.family}</Text>
            </View>
            <Text style={[typography.heading, { color: colors.gold }]}>›</Text>
          </Pressable>
        ))}
        {!loading && searchIsActive && !hasExactCatalogMatch ? (
          <Pressable
            accessibilityLabel={`Use ${normalizedQuery} for setup`}
            accessibilityRole="button"
            onPress={() => onGenerateCustomGuide(normalizedQuery)}
            style={({ pressed }) => ({
              gap: spacing.xs,
              padding: spacing.lg,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: colors.gold,
              backgroundColor: pressed ? colors.goldSoft : colors.surface,
            })}
          >
            <Text style={[typography.heading, { color: colors.text }]}>No exact match</Text>
            <Text style={[typography.body, { color: colors.gold }]}>{`Use “${normalizedQuery}”`}</Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Formie will use this exercise name to create your setup guide before you record.
            </Text>
          </Pressable>
        ) : null}
      </View>

      {!searchIsActive ? (
        <View testID="exercise-hero-section" style={{ alignItems: "center", gap: spacing.md }}>
          <View
            testID="exercise-hero"
            style={{
            width: "100%",
            height: 340,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "transparent",
          }}
          >
            <Image
              testID="exercise-hero-image"
              accessibilityLabel="Bench press exercise illustration"
              contentFit="contain"
              source={benchPressHero}
              style={{
                width: "128%",
                height: "128%",
                opacity: 0.35,
                transform: [{ translateY: 28 }],
              }}
            />
          </View>
          <Text
            testID="exercise-helper"
            style={[typography.heading, { color: colors.text, fontSize: 22, lineHeight: 28, textAlign: "center" }]}
          >
            Choose your exercise before recording
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
