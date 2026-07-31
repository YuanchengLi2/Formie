import { useEffect } from "react";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";

import { useAnalysisStatus } from "@/features/analysis/use-analysis-status";
import { AnalysisApiError } from "@/features/analysis/api";
import { useCaptureStore } from "@/features/capture/capture-store";
import { deviceVideoStore } from "@/features/capture/device-video-store";
import { AnalysisProgressScreen } from "@/screens/analysis-progress";

export default function AnalysisProgressRoute() {
  const router = useRouter();
  const { "session-id": sessionId = "" } = useLocalSearchParams<{ "session-id": string }>();
  const status = useAnalysisStatus(sessionId);
  const resetCapture = useCaptureStore((state) => state.dispatch);
  const reanalysis = useMutation({
    mutationFn: async () => {
      const declaration = status.data?.setDeclaration;
      if (!declaration) throw new Error("The saved set details are unavailable.");
      const recording = await deviceVideoStore.find(sessionId);
      if (!recording) throw new Error("This recording is no longer saved on this device.");
      resetCapture({
        type: "local_reanalysis_prepared",
        recording,
        declaration,
        previousSessionId: sessionId,
      });
    },
    onSuccess: () => {
      router.replace("/analysis/review");
    },
  });

  useEffect(() => {
    if (status.data?.result) router.replace(`/results/${sessionId}` as Href);
  }, [router, sessionId, status.data?.result]);

  const failureMessage = status.data?.status === "failed"
    ? status.data.failureCode === "GEMINI_FILE_FAILED"
      ? "The video could not be processed. Record again with the full set visible."
      : "Formie couldn't finish this analysis. Your recording is still saved."
    : status.error instanceof AnalysisApiError && status.error.code === "NETWORK_ERROR"
      ? "Connection lost while checking your analysis. Reconnect and try again."
      : status.error instanceof Error
        ? "Formie couldn't check the analysis status. Try again."
        : null;

  return (
    <AnalysisProgressScreen
      stage={status.data?.stage ?? null}
      failureMessage={failureMessage}
      onRetryAnalysis={status.data?.status === "failed" ? () => reanalysis.mutate(undefined) : undefined}
      retryingAnalysis={reanalysis.isPending}
      retryAnalysisError={reanalysis.error instanceof Error ? reanalysis.error.message : null}
      onRecordAgain={failureMessage ? () => {
        resetCapture({ type: "reset" });
        router.replace("/exercise-selection");
      } : undefined}
      onGoHome={failureMessage ? () => router.replace("/(tabs)/(home)") : undefined}
    />
  );
}
