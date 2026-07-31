import { Redirect, useLocalSearchParams } from "expo-router";

import { useCaptureStore } from "@/features/capture/capture-store";
import { CameraScreen } from "@/screens/camera";

export default function CameraRoute() {
  const { previousSessionId } = useLocalSearchParams<{ previousSessionId?: string }>();
  const phase = useCaptureStore((state) => state.phase);
  const recording = useCaptureStore((state) => state.recording);
  const exerciseChoice = useCaptureStore((state) => state.exerciseChoice);

  if (exerciseChoice.kind === "unselected") {
    return <Redirect href="/exercise-selection" />;
  }

  if (recording && (phase === "recorded" || phase === "error")) {
    return <Redirect href="/analysis/review" />;
  }

  return <CameraScreen previousSessionId={previousSessionId} />;
}
