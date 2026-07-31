import { useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import { searchExerciseCatalog, type CatalogExercise } from "@/features/analysis/exercise-catalog";
import { useCaptureStore } from "@/features/capture/capture-store";
import { ExerciseSelectionScreen } from "@/screens/exercise-selection";

export default function ExerciseSelectionRoute() {
  const router = useRouter();
  const { previousSessionId, mode } = useLocalSearchParams<{
    previousSessionId?: string;
    mode?: "review";
  }>();
  const exerciseChoice = useCaptureStore((state) => state.exerciseChoice);
  const dispatch = useCaptureStore((state) => state.dispatch);
  const initialExercise: CatalogExercise | null = exerciseChoice.kind === "selected"
    ? {
        id: exerciseChoice.catalogExerciseId,
        name: exerciseChoice.canonicalName,
        family: "Previous exercise",
        aliases: [],
        mechanics: exerciseChoice.mechanics,
      }
    : null;
  const onSearch = useCallback((query: string) => searchExerciseCatalog(query), []);
  const guideParams = {
    ...(previousSessionId ? { previousSessionId } : {}),
    ...(mode === "review" ? { flow: "review" as const } : {}),
  };

  return (
    <ExerciseSelectionScreen
        initialExercise={initialExercise}
        onSearch={onSearch}
        onSelect={(exercise) => {
          dispatch({
            type: "exercise_selected",
            exercise: {
              catalogExerciseId: exercise.id,
              canonicalName: exercise.name,
              mechanics: exercise.mechanics,
            },
          });
          router.push({
            pathname: "/exercise-guide",
            params: guideParams,
          });
        }}
        onGenerateCustomGuide={(canonicalName) => {
          dispatch({ type: "exercise_customized", canonicalName });
          router.push({
            pathname: "/exercise-guide",
            params: guideParams,
          });
        }}
      />
  );
}
