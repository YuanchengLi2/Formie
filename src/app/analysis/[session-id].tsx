import { useEffect } from "react";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";

import { useAnalysisStatus } from "@/features/analysis/use-analysis-status";
import { useCaptureStore } from "@/features/capture/capture-store";
import { AnalysisProgressScreen } from "@/screens/analysis-progress";

export default function AnalysisProgressRoute() {
  const router = useRouter();
  const { "session-id": sessionId = "" } = useLocalSearchParams<{ "session-id": string }>();
  const status = useAnalysisStatus(sessionId);
  const resetCapture = useCaptureStore((state) => state.dispatch);

  useEffect(() => {
    if (status.data?.result) router.replace(`/results/${sessionId}` as Href);
  }, [router, sessionId, status.data?.result]);

  const failureMessage =
    status.data?.status === "failed"
      ? "Analysis paused. Try again shortly."
      : status.error instanceof Error
        ? status.error.message
        : null;

  return (
    <AnalysisProgressScreen
      stage={status.data?.stage ?? null}
      failureMessage={failureMessage}
      onRecordAgain={failureMessage ? () => {
        resetCapture({ type: "reset" });
        router.replace("/recording-tips");
      } : undefined}
      onGoHome={failureMessage ? () => router.replace("/(tabs)/(home)") : undefined}
    />
  );
}
