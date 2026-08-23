import { useEffect } from "react";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";

import { useAnalysisStatus } from "@/features/analysis/use-analysis-status";
import { cancelAnalysis } from "@/features/access/api";
import { AnalysisApiError, reanalyzeAnalysis } from "@/features/analysis/api";
import { getAccessToken } from "@/features/auth/access-token";
import { useCaptureStore } from "@/features/capture/capture-store";
import { deviceVideoStore } from "@/features/capture/device-video-store";
import { AnalysisProgressScreen } from "@/screens/analysis-progress";
import { queryClient } from "@/lib/query-client";

export default function AnalysisProgressRoute() {
  const router = useRouter();
  const { "session-id": sessionId = "" } = useLocalSearchParams<{ "session-id": string }>();
  const status = useAnalysisStatus(sessionId);
  const resetCapture = useCaptureStore((state) => state.dispatch);
  const reanalysis = useMutation({
    mutationFn: async () => {
      const declaration = status.data?.setDeclaration;
      if (!declaration) throw new Error("The saved set details are unavailable.");
      try {
        const accessToken = await getAccessToken();
        const clientRequestId = globalThis.crypto?.randomUUID?.() ?? `reanalysis-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await reanalyzeAnalysis({ accessToken, sessionId, declaration, clientRequestId });
        return { kind: "server" as const };
      } catch (error) {
        if (!(error instanceof AnalysisApiError) || error.code !== "VIDEO_NOT_FOUND") throw error;
        const recording = await deviceVideoStore.find(sessionId);
        if (!recording) throw error;
        resetCapture({
          type: "local_reanalysis_prepared",
          recording,
          declaration,
          previousSessionId: sessionId,
        });
        return { kind: "local" as const };
      }
    },
    onSuccess: (result) => {
      if (result.kind === "server") {
        queryClient.removeQueries({ queryKey: ["analysis-status", sessionId] });
      }
      router.replace(result.kind === "server" ? `/analysis/${sessionId}` : "/analysis/review");
    },
  });

  useEffect(() => {
    const terminal = status.data?.status === "complete"
      || status.data?.status === "partial"
      || status.data?.status === "unable";
    if (terminal && status.data?.result) router.replace(`/results/${sessionId}` as Href);
  }, [router, sessionId, status.data?.result, status.data?.status]);

  const terminalWithoutResult = (status.data?.status === "complete"
    || status.data?.status === "partial"
    || status.data?.status === "unable")
    && !status.data?.result;
  const failureMessage = terminalWithoutResult
    ? "Your analysis finished, but its result could not be loaded. Retry the analysis or record again."
    : status.data?.status === "failed"
    ? status.data.failureReason
      ?? (status.data.failureCode === "GEMINI_FILE_FAILED"
      ? "The video could not be processed. Record again with the full set visible."
      : "Formie couldn't finish this analysis. Your recording is still saved.")
    : status.error instanceof AnalysisApiError && status.error.code === "NETWORK_ERROR"
      ? "Connection lost while checking your analysis. Reconnect and try again."
      : status.error instanceof Error
        ? "Formie couldn't check the analysis status. Try again."
        : null;

  return (
    <AnalysisProgressScreen
      mode="analysis"
      stage={status.data?.stage ?? null}
      failureMessage={failureMessage}
      onRetryAnalysis={status.data?.status === "failed" || terminalWithoutResult ? () => reanalysis.mutate(undefined) : undefined}
      retryingAnalysis={reanalysis.isPending}
      retryAnalysisError={reanalysis.error instanceof Error ? reanalysis.error.message : null}
      onRecordAgain={failureMessage ? () => {
        void cancelAnalysis({ sessionId }).catch(() => undefined);
        resetCapture({ type: "reset" });
        router.replace("/exercise-selection");
      } : undefined}
      onGoHome={failureMessage ? () => router.replace("/(tabs)/(home)") : undefined}
    />
  );
}
