import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Text, View } from "react-native";

import type { CoachingFinding } from "@/features/analysis/result-schema";
import { useAnalysisStatus } from "@/features/analysis/use-analysis-status";
import { useExerciseTutorial } from "@/features/analysis/use-exercise-tutorial";
import { useCaptureStore } from "@/features/capture/capture-store";
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
      onAskCoach={() => router.push({ pathname: "/(tabs)/(coach)/index", params: { sessionId } })}
      onRecordAnother={() => {
        resetCapture({ type: "reset" });
        router.replace({ pathname: "/recording-tips", params: { previousSessionId: sessionId } });
      }}
    />
  );
}
