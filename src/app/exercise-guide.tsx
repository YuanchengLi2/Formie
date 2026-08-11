import { useCallback, useEffect, useState } from "react";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { Linking } from "react-native";

import { getExerciseGuide, type ExerciseGuide } from "@/features/analysis/api";
import { getAccessToken } from "@/features/auth/access-token";
import { useCaptureStore } from "@/features/capture/capture-store";
import { getCaptureExerciseGuideKey } from "@/features/capture/exercise-guide-key";
import { loadExerciseGuideOnce } from "@/features/capture/exercise-guide-loader";
import { exerciseGuideStore } from "@/features/capture/exercise-guide-store";
import { analysisUploadCoordinator } from "@/features/capture/analysis-upload-coordinator";
import { ExerciseGuideScreen } from "@/screens/exercise-guide";

export default function ExerciseGuideRoute() {
  const router = useRouter();
  const { previousSessionId, flow } = useLocalSearchParams<{
    previousSessionId?: string;
    flow?: "rejected" | "review";
  }>();
  const exerciseChoice = useCaptureStore((state) => state.exerciseChoice);
  const cachedGuide = useCaptureStore((state) => state.exerciseGuide);
  const cachedGuideKey = useCaptureStore((state) => state.exerciseGuideKey);
  const dispatch = useCaptureStore((state) => state.dispatch);
  const guideKey = getCaptureExerciseGuideKey(exerciseChoice);
  const matchingGuide = guideKey && cachedGuideKey === guideKey ? cachedGuide : null;
  const [guide, setGuide] = useState<ExerciseGuide | null>(matchingGuide);
  const [loading, setLoading] = useState(!matchingGuide);
  const [error, setError] = useState<string | null>(null);

  const loadGuide = useCallback(async (force = false) => {
    if (
      !guideKey
      || (exerciseChoice.kind !== "selected" && exerciseChoice.kind !== "custom")
    ) return;
    if (!force && cachedGuideKey === guideKey && cachedGuide) {
      setGuide(cachedGuide);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (!force) {
        try {
          const persistedGuide = await exerciseGuideStore.find(guideKey);
          if (persistedGuide) {
            dispatch({ type: "exercise_guide_loaded", key: guideKey, guide: persistedGuide });
            setGuide(persistedGuide);
            return;
          }
        } catch {
          // Device cache failures should not block fresh guide generation.
        }
      }
      const response = await loadExerciseGuideOnce(guideKey, async () => {
        const accessToken = await getAccessToken();
        return exerciseChoice.kind === "selected"
          ? getExerciseGuide({ accessToken, catalogExerciseId: exerciseChoice.catalogExerciseId })
          : getExerciseGuide({ accessToken, customExerciseName: exerciseChoice.canonicalName });
      }, force);
      dispatch({ type: "exercise_guide_loaded", key: guideKey, guide: response });
      setGuide(response);
      try {
        await exerciseGuideStore.save(guideKey, response);
      } catch {
        // The guide remains usable for this recording even if device persistence fails.
      }
    } catch (guideError) {
      setGuide(null);
      setError(guideError instanceof Error ? guideError.message : "Guide unavailable");
    } finally {
      setLoading(false);
    }
  }, [cachedGuide, cachedGuideKey, dispatch, exerciseChoice, guideKey]);

  useEffect(() => {
    void loadGuide();
  }, [loadGuide]);

  if (exerciseChoice.kind !== "selected" && exerciseChoice.kind !== "custom") return <Redirect href="/exercise-selection" />;

  return (
    <ExerciseGuideScreen
      exerciseName={exerciseChoice.canonicalName}
      guide={guide}
      loading={loading}
      error={error}
      onBack={() => router.back()}
      onRetry={() => void loadGuide(true)}
      onContinue={() => {
        if (flow === "review") {
          router.replace("/analysis/set-details");
          return;
        }
        if (flow === "rejected") {
          analysisUploadCoordinator.reset();
          dispatch({ type: "discard_recording" });
          router.replace({
            pathname: "/camera",
            params: previousSessionId ? { previousSessionId } : {},
          });
          return;
        }
        router.replace({
          pathname: "/camera",
          params: previousSessionId ? { previousSessionId } : {},
        });
      }}
      onOpenSpaceHelp={() => router.push("/no-phone-space")}
      onOpenTutorial={(tutorial) => void Linking.openURL(tutorial.url)}
    />
  );
}
