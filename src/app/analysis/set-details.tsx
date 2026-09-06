import { useCallback, useState } from "react";
import { BackHandler } from "react-native";
import { Redirect, useFocusEffect, useRouter } from "expo-router";

import { analysisUploadCoordinator } from "@/features/capture/analysis-upload-coordinator";
import { createAnalysisClientRequestId, getAnalysisRecoveryStore } from "@/features/capture/analysis-recovery-store";
import { useCaptureStore } from "@/features/capture/capture-store";
import { useAuth } from "@/features/auth/auth-provider";
import type { SetDeclaration } from "@/features/analysis/set-declaration";
import { SetDeclarationScreen } from "@/screens/set-declaration";

export default function AnalysisSetDetailsRoute() {
  const router = useRouter();
  const auth = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const phase = useCaptureStore((state) => state.phase);
  const recording = useCaptureStore((state) => state.recording);
  const declaration = useCaptureStore((state) => state.declaration);
  const exerciseChoice = useCaptureStore((state) => state.exerciseChoice);
  const previousSessionId = useCaptureStore((state) => state.previousSessionId);
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

  const beginUpload = async (submitted: SetDeclaration) => {
    if (submitting) return;
    if (!auth.user?.id) {
      setSubmitError("Your account session is unavailable. Sign in again and retry.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const clientRequestId = createAnalysisClientRequestId();
    try {
      await getAnalysisRecoveryStore().saveUpload({
        userId: auth.user.id,
        recording,
        declaration: submitted,
        previousSessionId,
        clientRequestId,
        sessionId: null,
      });
      dispatch({ type: "declaration_submitted", declaration: submitted });
      dispatch({ type: "upload_started", clientRequestId });
      router.replace("/analysis/upload");
    } catch {
      setSubmitError("Formie could not safely save this upload. Check device storage and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
      <SetDeclarationScreen
        localVideoUri={recording.localUri}
        onBack={() => router.replace("/analysis/review")}
        initialDeclaration={declaration}
        preselectedExercise={exerciseChoice.kind === "selected" ? exerciseChoice : null}
        initialExerciseName={exerciseChoice.kind === "custom" ? exerciseChoice.canonicalName : undefined}
        analyzeLabel="Analyze this video"
        submitError={submitError}
        submitting={submitting}
        showVideoPreview={false}
        onChangeExercise={() => router.push({ pathname: "/exercise-selection", params: { mode: "review" } })}
        onAnalyze={beginUpload}
        onRetake={retake}
      />
  );
}
