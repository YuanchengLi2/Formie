import { useRouter } from "expo-router";
import { Stack } from "expo-router/stack";

import { ExerciseSearchScreen } from "@/screens/exercise-search";

export default function ExerciseSearchRoute() {
  const router = useRouter();
  return (
    <>
      <Stack.Title>Choose Exercise</Stack.Title>
      <ExerciseSearchScreen onSelect={(slug) => router.push({ pathname: "/exercises/[slug]", params: { slug } })} />
    </>
  );
}
