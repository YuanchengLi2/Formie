import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Text, TextInput, View } from "react-native";
import { HapticPressable as Pressable } from "@/components/haptic-pressable";
import { Image } from "expo-image";

import { ExerciseFamilyIcon } from "@/components/exercise-family-icon";
import { ResponsiveScreen } from "@/components/responsive-screen";
import { exerciseSearchHighlightTerms, normalizeExerciseSearch, type CatalogExercise } from "@/features/analysis/exercise-catalog";
import { inferExerciseFamily, isExerciseFamily } from "@/features/exercises/exercise-family";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";
import { usePhoneLayoutProfile } from "@/theme/responsive";

type ExerciseSelectionScreenProps = {
  initialExercise?: CatalogExercise | null;
  onSearch: (query: string) => Promise<CatalogExercise[]>;
  onSelect: (exercise: CatalogExercise) => void;
  onGenerateCustomGuide: (exerciseName: string) => void;
};

const benchPressHero = require("../../../assets/production/choose-exercise-bench.png");

function HighlightedExerciseName({ name, query }: { name: string; query: string }) {
  const queryWords = new Set(exerciseSearchHighlightTerms(query));
  return (
    <Text style={[typography.heading, { color: colors.text }]}>
      {name.split(/(\s+)/).map((part, index) => (
        <Text key={`${part}-${index}`} style={queryWords.has(normalizeExerciseSearch(part)) ? { color: colors.gold } : undefined}>{part}</Text>
      ))}
    </Text>
  );
}

export function ExerciseSelectionScreen({
  initialExercise = null,
  onSearch,
  onSelect,
  onGenerateCustomGuide,
}: ExerciseSelectionScreenProps) {
  const layout = usePhoneLayoutProfile();
  const [query, setQuery] = useState(initialExercise?.name ?? "");
  const [results, setResults] = useState<CatalogExercise[]>(initialExercise ? [initialExercise] : []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const normalizedQuery = query.trim();
  const searchIsActive = normalizedQuery.length >= 2;
  const normalizedSearchQuery = normalizeExerciseSearch(normalizedQuery);
  const hasExactCatalogMatch = results.some((exercise) => (
    normalizeExerciseSearch(exercise.name) === normalizedSearchQuery
    || exercise.aliases.some((alias) => normalizeExerciseSearch(alias) === normalizedSearchQuery)
  ));

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setResults(initialExercise && normalized === initialExercise.name ? [initialExercise] : []);
      setLoading(false);
      setError(null);
      return;
    }

    const sequence = ++requestSequence.current;
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      void onSearch(normalized)
        .then((matches) => {
          if (active && sequence === requestSequence.current) setResults(matches);
        })
        .catch(() => {
          if (active && sequence === requestSequence.current) {
            setResults([]);
            setError("Exercises could not be loaded. Retry, or use the exercise name you entered.");
          }
        })
        .finally(() => {
          if (active && sequence === requestSequence.current) setLoading(false);
        });
    }, 180);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [initialExercise, onSearch, query]);

  return (
    <ResponsiveScreen
      keyboardAware
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      onScrollBeginDrag={Keyboard.dismiss}
      testID="exercise-selection-scroll"
      contentContainerStyle={{ gap: spacing.lg, paddingTop: spacing.lg }}
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
              <HighlightedExerciseName name={exercise.name} query={normalizedQuery} />
              <Text style={[typography.caption, { color: colors.textMuted }]}>{exercise.family}</Text>
              {typeof exercise.mechanics.equipmentClass === "string" ? (
                <Text style={[typography.caption, { color: colors.textMuted }]}>{exercise.mechanics.equipmentClass}</Text>
              ) : null}
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
            <Text style={[typography.heading, { color: colors.text }]}>Can’t find your exercise?</Text>
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
            height: Math.min(340, layout.artworkMaxHeight),
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
                width: "100%",
                height: "100%",
                opacity: 0.35,
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
    </ResponsiveScreen>
  );
}
