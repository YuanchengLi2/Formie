import { useEffect } from "react";
import { useRouter } from "expo-router";

import { analysisUploadCoordinator } from "@/features/capture/analysis-upload-coordinator";
import { useCaptureStore } from "@/features/capture/capture-store";
import { AnalysisProgressScreen } from "@/screens/analysis-progress";
import { getAnalyticsContext } from "@/features/analytics/product-analytics";

export default function AnalysisUploadRoute() {
  const router = useRouter();
  const phase = useCaptureStore((state) => state.phase);
  const recording = useCaptureStore((state) => state.recording);
  const declaration = useCaptureStore((state) => state.declaration);
  const previousSessionId = useCaptureStore((state) => state.previousSessionId);
  const captureFlowId = useCaptureStore((state) => state.captureFlowId);
  const uploadSubstage = useCaptureStore((state) => state.uploadSubstage);
  const error = useCaptureStore((state) => state.error);
  const dispatch = useCaptureStore((state) => state.dispatch);

  useEffect(() => {
    if (phase !== "uploading" || !recording || !declaration) return;
    let active = true;
    const unsubscribe = analysisUploadCoordinator.subscribe((progress) => {
      if (!active) return;
      dispatch({ type: "upload_progress", substage: progress.substage, target: progress.target });
    });
    void analysisUploadCoordinator.run(recording, declaration, previousSessionId ?? undefined, getAnalyticsContext(captureFlowId))
      .then(({ sessionId, target }) => {
        if (!active) return;
        if (!useCaptureStore.getState().uploadTarget) dispatch({ type: "upload_target_created", target });
        dispatch({ type: "processing", sessionId });
        router.replace({ pathname: "/analysis/[session-id]", params: { "session-id": sessionId } });
      })
      .catch((uploadError) => {
        if (!active) return;
        dispatch({
          type: "upload_failed",
          message: uploadError instanceof Error ? uploadError.message : "The original video could not be uploaded",
        });
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [captureFlowId, declaration, dispatch, phase, previousSessionId, recording, router]);

  const discard = () => {
    void analysisUploadCoordinator.cancelUpload().finally(() => {
      dispatch({ type: "discard_recording" });
      router.replace("/camera");
    });
  };

  const missingRecording = !recording || !declaration ? "The saved recording or set details are no longer available." : null;
  const failureMessage = phase === "error" ? error : missingRecording;

  return (
    <AnalysisProgressScreen
      mode="upload"
      stage={uploadSubstage ?? "creating_session"}
      failureMessage={failureMessage}
      onRetryUpload={phase === "error" && recording ? () => dispatch({ type: "retry_upload" }) : undefined}
      onRecordAgain={failureMessage ? discard : undefined}
      onGoHome={missingRecording ? () => router.replace("/(tabs)/(home)") : undefined}
    />
  );
}
