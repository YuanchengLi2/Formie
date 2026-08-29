import { useCallback } from "react";
import { BackHandler } from "react-native";
import { Redirect, useFocusEffect, useRouter } from "expo-router";

import { analysisUploadCoordinator } from "@/features/capture/analysis-upload-coordinator";
import { useCaptureStore } from "@/features/capture/capture-store";
import { SetDeclarationScreen } from "@/screens/set-declaration";
import { analyticsExerciseId, trackProductEvent } from "@/features/analytics/product-analytics";

export default function AnalysisSetDetailsRoute() {
  const router = useRouter();
  const phase = useCaptureStore((state) => state.phase);
  const recording = useCaptureStore((state) => state.recording);
  const declaration = useCaptureStore((state) => state.declaration);
  const exerciseChoice = useCaptureStore((state) => state.exerciseChoice);
  const previousSessionId = useCaptureStore((state) => state.previousSessionId);
  const captureFlowId = useCaptureStore((state) => state.captureFlowId);
  const dispatch = useCaptureStore((state) => state.dispatch);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      router.replace("/analysis/review");
      return true;
    });
    return () => subscription.remove();
  }, [router]));

  if (!recording || (phase !== "recorded" && phase !== "error")) {
    return <Redirect href="/camera" />;
  }

  const retake = () => {
    analysisUploadCoordinator.reset();
    dispatch({ type: "discard_recording" });
    router.replace({
      pathname: "/recording-tips",
      params: previousSessionId ? { previousSessionId } : {},
    });
  };

  return (
    <SetDeclarationScreen
      localVideoUri={recording.localUri}
      onBack={() => router.replace("/analysis/review")}
      initialDeclaration={declaration}
      preselectedExercise={exerciseChoice.kind === "selected" ? exerciseChoice : null}
      initialExerciseName={exerciseChoice.kind === "custom" ? exerciseChoice.canonicalName : undefined}
      showVideoPreview={false}
      onChangeExercise={() => router.push({ pathname: "/exercise-selection", params: { mode: "review" } })}
      onAnalyze={(submitted) => {
        trackProductEvent("upload_started", { exerciseId: analyticsExerciseId(submitted.exercise.source === "catalog" ? submitted.exercise.catalogExerciseId : null), source: submitted.exercise.source }, captureFlowId ? { captureFlowId } : undefined);
        dispatch({ type: "declaration_submitted", declaration: submitted });
        dispatch({ type: "upload_started" });
        router.replace("/analysis/upload");
      }}
      onRetake={retake}
    />
  );
}
