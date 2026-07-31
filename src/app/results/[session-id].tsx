import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";

import { declarationForReanalysis } from "@/features/analysis/reanalysis-declaration";
import type { SetDeclaration } from "@/features/analysis/set-declaration";
import { useAnalysisStatus } from "@/features/analysis/use-analysis-status";
import { useExerciseTutorial } from "@/features/analysis/use-exercise-tutorial";
import { useCaptureStore } from "@/features/capture/capture-store";
import { deviceVideoStore } from "@/features/capture/device-video-store";
import type { RecordedSet } from "@/features/capture/types";
import { ResultsScreen } from "@/screens/results";
import { SetDeclarationScreen } from "@/screens/set-declaration";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

export default function ResultsRoute() {
  const router = useRouter();
  const { "session-id": sessionId = "" } = useLocalSearchParams<{ "session-id": string }>();
  const status = useAnalysisStatus(sessionId, { includeVideoUrl: true, mode: "status" });
  const tutorial = useExerciseTutorial(sessionId, Boolean(status.data?.result));
  const [confirmingReanalysis, setConfirmingReanalysis] = useState(false);
  const [reanalysisRecording, setReanalysisRecording] = useState<RecordedSet | null>(null);
  const [preparingReanalysis, setPreparingReanalysis] = useState(false);
  const [reanalysisPreparationError, setReanalysisPreparationError] = useState<string | null>(null);
  const resetCapture = useCaptureStore((state) => state.dispatch);
  const reanalysis = useMutation({
    mutationFn: async (declaration?: SetDeclaration) => {
      if (!declaration) throw new Error("Set details are required");
      const localRecording = reanalysisRecording ?? await deviceVideoStore.find(sessionId);
      if (!localRecording) throw new Error("This recording is no longer saved on this device.");
      resetCapture({
        type: "local_reanalysis_prepared",
        recording: localRecording,
        declaration,
        previousSessionId: sessionId,
      });
      return { kind: "local" as const };
    },
    onSuccess: () => {
      router.replace("/analysis/review");
    },
  });
  const prepareReanalysis = async () => {
    setPreparingReanalysis(true);
    setReanalysisPreparationError(null);
    try {
      const localRecording = await deviceVideoStore.find(sessionId);
      if (!localRecording) {
        setReanalysisPreparationError("This recording is no longer saved on this device.");
        return;
      }
      setReanalysisRecording(localRecording);
      setConfirmingReanalysis(true);
    } finally {
      setPreparingReanalysis(false);
    }
  };
  if (!status.data?.result) {
    const failureMessage = status.data?.status === "failed"
      ? status.data.failureCode === "GEMINI_FILE_FAILED"
        ? "The video could not be processed. Record again with the full set visible."
        : "Formie couldn't finish this analysis. Record again to start a fresh review."
      : status.error instanceof Error
        ? status.error.message
        : null;
    return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.sm, padding: spacing.xl, backgroundColor: colors.background }}>
      <Text selectable style={[typography.heading, { color: colors.text }]}>{failureMessage ? "Couldn’t open analysis" : "Opening analysis…"}</Text>
      {failureMessage ? <Text selectable style={[typography.body, { color: colors.textSecondary, textAlign: "center" }]}>{failureMessage}</Text> : null}
    </View>;
  }

  const initialReanalysisDeclaration = declarationForReanalysis(
    status.data.result,
    status.data.setDeclaration,
  );

  if (confirmingReanalysis && reanalysisRecording) {
    return (
      <SetDeclarationScreen
        localVideoUri={reanalysisRecording.localUri}
        initialDeclaration={initialReanalysisDeclaration}
        analyzeLabel="Analyze Again"
        secondaryLabel="Cancel"
        showSide={false}
        onAnalyze={(declaration) => reanalysis.mutate(declaration)}
        onRetake={() => {
          setConfirmingReanalysis(false);
          setReanalysisRecording(null);
        }}
      />
    );
  }

  return (
    <ResultsScreen
      result={status.data.result}
      videoUrl={status.data.videoUrl}
      durationMs={status.data.durationMs}
      playbackWindow={status.data.playbackWindow}
      onReanalyze={() => void prepareReanalysis()}
      reanalyzing={preparingReanalysis || reanalysis.isPending}
      reanalysisError={reanalysisPreparationError ?? (reanalysis.error instanceof Error ? reanalysis.error.message : null)}
      exampleState={tutorial.isPending ? "loading" : tutorial.data ? "ready" : "error"}
      onWatchExample={() => {
        if (tutorial.data) {
          void WebBrowser.openBrowserAsync(tutorial.data.url);
        } else {
          void tutorial.refetch();
        }
      }}
      onAskCoach={() => router.push({ pathname: "/(tabs)/(coach)", params: { sessionId } })}
      onRecordAnother={() => {
        resetCapture({ type: "reset" });
        const previousExercise = status.data.setDeclaration?.exercise;
        if (previousExercise?.source === "catalog") {
          resetCapture({
            type: "exercise_selected",
            exercise: {
              catalogExerciseId: previousExercise.catalogExerciseId,
              canonicalName: previousExercise.label,
              mechanics: {},
            },
          });
        }
        router.replace({ pathname: "/exercise-selection", params: { previousSessionId: sessionId } });
      }}
    />
  );
}
