import { useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import { searchExerciseCatalog, type CatalogExercise } from "@/features/analysis/exercise-catalog";
import { useCaptureStore } from "@/features/capture/capture-store";
import { ExerciseSelectionScreen } from "@/screens/exercise-selection";
import { randomAnalyticsUuid } from "@/features/analytics/analytics-session";
import { analyticsExerciseId, trackProductEvent } from "@/features/analytics/product-analytics";

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
          const captureFlowId = randomAnalyticsUuid();
          dispatch({
            type: "exercise_selected",
            captureFlowId,
            exercise: {
              catalogExerciseId: exercise.id,
              canonicalName: exercise.name,
              mechanics: exercise.mechanics,
            },
          });
          trackProductEvent("exercise_selected", { exerciseId: analyticsExerciseId(exercise.id), source: "catalog", hasPreviousAnalysis: Boolean(previousSessionId) }, { captureFlowId });
          router.push({
            pathname: "/exercise-guide",
            params: guideParams,
          });
        }}
        onGenerateCustomGuide={(canonicalName) => {
          const captureFlowId = randomAnalyticsUuid();
          dispatch({ type: "exercise_customized", canonicalName, captureFlowId });
          trackProductEvent("exercise_selected", { exerciseId: "custom", source: "custom", hasPreviousAnalysis: Boolean(previousSessionId) }, { captureFlowId });
          router.push({
            pathname: "/exercise-guide",
            params: guideParams,
          });
        }}
      />
  );
}
