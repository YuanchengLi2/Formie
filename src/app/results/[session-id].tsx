import { type Href, useLocalSearchParams, useRouter } from "expo-router";

import { correctAnalysisLabel } from "@/features/analysis/api";
import type { CoachingFinding } from "@/features/analysis/result-schema";
import { useAnalysisStatus } from "@/features/analysis/use-analysis-status";
import { useCaptureStore } from "@/features/capture/capture-store";
import { supabase } from "@/lib/supabase";
import { AnalysisProgressScreen } from "@/screens/analysis-progress";
import { ResultsScreen } from "@/screens/results";

async function accessToken(): Promise<string> {
  const session = await supabase.auth.getSession();
  if (!session.data.session?.access_token) throw new Error("Your private session expired. Please reopen FORM.");
  return session.data.session.access_token;
}

export default function ResultsRoute() {
  const router = useRouter();
  const { "session-id": sessionId = "" } = useLocalSearchParams<{ "session-id": string }>();
  const status = useAnalysisStatus(sessionId);
  const resetCapture = useCaptureStore((state) => state.dispatch);

  if (!status.data?.result) {
    return <AnalysisProgressScreen stage={status.data?.stage ?? null} failureMessage={status.error instanceof Error ? status.error.message : null} />;
  }

  const openFinding = (finding: CoachingFinding) => {
    router.push(`/results/${sessionId}/finding/${finding.id}` as Href);
  };

  const correctLabel = async (label: string) => {
    await correctAnalysisLabel({ accessToken: await accessToken(), sessionId, label });
    await status.refetch();
  };

  return (
    <ResultsScreen
      result={status.data.result}
      onCorrectLabel={correctLabel}
      onFindingPress={openFinding}
      onRecordAnother={() => {
        resetCapture({ type: "reset" });
        router.replace({ pathname: "/recording-tips", params: { previousSessionId: sessionId } });
      }}
    />
  );
}
