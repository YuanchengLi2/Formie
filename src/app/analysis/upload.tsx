import { useEffect } from "react";
import { useRouter } from "expo-router";

import { analysisUploadCoordinator } from "@/features/capture/analysis-upload-coordinator";
import { useCaptureStore } from "@/features/capture/capture-store";
import { AnalysisProgressScreen } from "@/screens/analysis-progress";

export default function AnalysisUploadRoute() {
  const router = useRouter();
  const phase = useCaptureStore((state) => state.phase);
  const recording = useCaptureStore((state) => state.recording);
  const previousSessionId = useCaptureStore((state) => state.previousSessionId);
  const error = useCaptureStore((state) => state.error);
  const dispatch = useCaptureStore((state) => state.dispatch);

  useEffect(() => {
    if (phase !== "uploading" || !recording) return;
    let active = true;
    void analysisUploadCoordinator.run(recording, previousSessionId ?? undefined)
      .then(({ sessionId }) => {
        if (!active) return;
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
    return () => { active = false; };
  }, [dispatch, phase, previousSessionId, recording, router]);

  const discard = () => {
    analysisUploadCoordinator.reset();
    dispatch({ type: "reset" });
    router.replace("/recording-tips");
  };

  const missingRecording = !recording ? "The saved recording is no longer available." : null;
  const failureMessage = phase === "error" ? error : missingRecording;

  return (
    <AnalysisProgressScreen
      stage="uploading"
      failureMessage={failureMessage}
      onRetryUpload={phase === "error" && recording ? () => dispatch({ type: "retry_upload" }) : undefined}
      onRecordAgain={failureMessage ? discard : undefined}
      onGoHome={missingRecording ? () => router.replace("/(tabs)/(home)") : undefined}
    />
  );
}
