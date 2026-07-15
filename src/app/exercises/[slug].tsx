import { useLocalSearchParams, useRouter } from "expo-router";
import { Stack } from "expo-router/stack";

import { findExercise } from "@/features/exercises/catalog";
import { ExerciseDetailScreen } from "@/screens/exercise-detail";

export default function ExerciseDetailRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const exercise = findExercise(slug);

  if (!exercise) {
    return null;
  }

  return (
    <>
      <Stack.Title>{exercise.name}</Stack.Title>
      <ExerciseDetailScreen
        exercise={exercise}
        onContinue={() => router.push({ pathname: "/capture/setup", params: { exercise: exercise.slug } } as never)}
        onChooseAnother={() => router.replace("/exercises")}
      />
    </>
  );
}
