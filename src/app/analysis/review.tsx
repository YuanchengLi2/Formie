import { useCallback } from "react";
import { BackHandler } from "react-native";
import { Redirect, useFocusEffect, useRouter } from "expo-router";

import { useAccess } from "@/features/access/access-provider";
import { analysisUploadCoordinator } from "@/features/capture/analysis-upload-coordinator";
import { useCaptureStore } from "@/features/capture/capture-store";
import { RecordingReviewScreen } from "@/screens/recording-review";

export default function AnalysisReviewRoute() {
  const router = useRouter();
  const access = useAccess();
  const phase = useCaptureStore((state) => state.phase);
  const recording = useCaptureStore((state) => state.recording);
  const previousSessionId = useCaptureStore((state) => state.previousSessionId);
  const dispatch = useCaptureStore((state) => state.dispatch);

  const retake = useCallback(() => {
    analysisUploadCoordinator.reset();
    dispatch({ type: "discard_recording" });
    router.replace({
      pathname: "/recording-tips",
      params: previousSessionId ? { previousSessionId } : {},
    });
  }, [dispatch, previousSessionId, router]);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      retake();
      return true;
    });
    return () => subscription.remove();
  }, [retake]));

  if (!recording || (phase !== "recorded" && phase !== "error")) {
    return <Redirect href="/camera" />;
  }

  return (
    <RecordingReviewScreen
      analysisRemaining={access.access.remaining}
      localVideoUri={recording.localUri}
      onUseRecording={() => router.replace("/analysis/set-details")}
      onRetake={retake}
    />
  );
}
