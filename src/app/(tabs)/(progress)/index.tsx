import { Alert } from "react-native";
import { type Href, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { deleteAnalysisSession, setAnalysisPinned } from "@/features/progress/api";
import { groupAnalysisSessions } from "@/features/progress/group-sessions";
import { invalidateAnalysisHistory } from "@/features/progress/history-cache";
import { useAnalysisHistory } from "@/features/progress/use-analysis-history";
import { ProgressScreen } from "@/screens/progress";

export default function ProgressRoute() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const history = useAnalysisHistory();
  const refresh = () => invalidateAnalysisHistory(queryClient);
  return <ProgressScreen groups={groupAnalysisSessions(history.data ?? [])} onOpenSession={(sessionId, status) => router.push(`/${status === "processing" ? "analysis" : "results"}/${sessionId}` as Href)} onRecord={() => router.push("/recording-tips")} onTogglePin={async (sessionId, pinned) => { try { await setAnalysisPinned(sessionId, pinned); await refresh(); } catch (error) { Alert.alert("Could not update analysis", error instanceof Error ? error.message : "Try again."); } }} onDeleteSession={async (sessionId) => { try { await deleteAnalysisSession(sessionId); await refresh(); } catch (error) { Alert.alert("Could not delete analysis", error instanceof Error ? error.message : "Try again."); } }} />;
}
