import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useMutation } from "@tanstack/react-query";
import { Text, View } from "react-native";

import { getAccessToken } from "@/features/auth/access-token";
import { reanalyzeAnalysis } from "@/features/analysis/api";
import type { CoachingFinding } from "@/features/analysis/result-schema";
import { useAnalysisStatus } from "@/features/analysis/use-analysis-status";
import { useExerciseTutorial } from "@/features/analysis/use-exercise-tutorial";
import { useCaptureStore } from "@/features/capture/capture-store";
import { invalidateAnalysisHistory } from "@/features/progress/history-cache";
import { queryClient } from "@/lib/query-client";
import { ResultsScreen } from "@/screens/results";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

export default function ResultsRoute() {
  const router = useRouter();
  const { "session-id": sessionId = "" } = useLocalSearchParams<{ "session-id": string }>();
  const status = useAnalysisStatus(sessionId, { includeVideoUrl: true, mode: "status" });
  const tutorial = useExerciseTutorial(sessionId, status.data?.result?.status === "complete" || status.data?.result?.status === "partial");
  const resetCapture = useCaptureStore((state) => state.dispatch);
  const reanalysis = useMutation({
    mutationFn: async () => reanalyzeAnalysis({ accessToken: await getAccessToken(), sessionId }),
    onSuccess: async () => {
      await queryClient.cancelQueries({ queryKey: ["analysis-status", sessionId] });
      queryClient.removeQueries({ queryKey: ["analysis-status", sessionId] });
      queryClient.removeQueries({ queryKey: ["exercise-tutorial", sessionId] });
      await invalidateAnalysisHistory(queryClient);
      router.replace(`/analysis/${sessionId}` as Href);
    },
  });

  if (!status.data?.result) {
    const failureMessage = status.data?.status === "failed"
      ? "Analysis paused. Record again to start a fresh review."
      : status.error instanceof Error
        ? status.error.message
        : null;
    return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.sm, padding: spacing.xl, backgroundColor: colors.background }}>
      <Text selectable style={[typography.heading, { color: colors.text }]}>{failureMessage ? "Couldn’t open analysis" : "Opening analysis…"}</Text>
      {failureMessage ? <Text selectable style={[typography.body, { color: colors.textSecondary, textAlign: "center" }]}>{failureMessage}</Text> : null}
    </View>;
  }

  const openFinding = (finding: CoachingFinding) => {
    router.push(`/results/${sessionId}/finding/${finding.id}` as Href);
  };

  return (
    <ResultsScreen
      result={status.data.result}
      videoUrl={status.data.videoUrl}
      durationMs={status.data.durationMs}
      tutorial={tutorial.data}
      tutorialLoading={tutorial.isLoading}
      onOpenTutorial={(video) => void WebBrowser.openBrowserAsync(video.url)}
      onFindingPress={openFinding}
      showDebugReanalysis={__DEV__}
      onReanalyze={() => reanalysis.mutate()}
      reanalyzing={reanalysis.isPending}
      reanalysisError={reanalysis.error instanceof Error ? reanalysis.error.message : null}
      onAskCoach={() => router.push({ pathname: "/(tabs)/(coach)", params: { sessionId } })}
      onRecordAnother={() => {
        resetCapture({ type: "reset" });
        router.replace({ pathname: "/recording-tips", params: { previousSessionId: sessionId } });
      }}
    />
  );
}
