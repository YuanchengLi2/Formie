import { Alert } from "react-native";
import { type Href, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { analysisEntryHref, resolveAnalysisEntry } from "@/features/access/account-access";
import { useAccess } from "@/features/access/access-provider";
import { formatQuotaMessage, formatQuotaTitle } from "@/features/access/quota-message";
import { deleteAnalysisSession, setAnalysisPinned } from "@/features/progress/api";
import { groupAnalysisSessions } from "@/features/progress/group-sessions";
import { invalidateAnalysisHistory } from "@/features/progress/history-cache";
import { useAnalysisHistory } from "@/features/progress/use-analysis-history";
import { ProgressScreen } from "@/screens/progress";

export default function ProgressRoute() {
  const router = useRouter();
  const access = useAccess();
  const queryClient = useQueryClient();
  const history = useAnalysisHistory();
  const refresh = () => invalidateAnalysisHistory(queryClient);
  const startAnalysis = () => {
    const entry = resolveAnalysisEntry(access.status, access.access);
    const href = analysisEntryHref(entry, access.access.pendingAnalysisSessionId);
    if (href) {
      router.push(href as Href);
      return;
    }
    if (entry === "renewal_pending") {
      void access.refresh().catch(() => undefined);
      return;
    }
    if (entry === "quota_exhausted") {
      Alert.alert(formatQuotaTitle(access.access.lifecycleState, access.access.paidThrough), formatQuotaMessage({ lifecycleState: access.access.lifecycleState, limit: access.access.quotaLimit, resetsAt: access.access.quotaResetsAt, paidThrough: access.access.paidThrough }));
      return;
    }
    Alert.alert("Analysis access unavailable", "Formie could not confirm your analysis balance. Check your connection and try again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Try again", onPress: () => void access.refresh().catch(() => undefined) },
    ]);
  };
  return <ProgressScreen groups={groupAnalysisSessions(history.data ?? [])} onStartAnalysis={startAnalysis} onOpenProfile={() => router.push("/(tabs)/(profile)")} onOpenSession={(sessionId, status) => router.push(`/${status === "processing" || status === "failed" ? "analysis" : "results"}/${sessionId}` as Href)} onTogglePin={async (sessionId, pinned) => { try { await setAnalysisPinned(sessionId, pinned); await refresh(); } catch (error) { Alert.alert("Could not update analysis", error instanceof Error ? error.message : "Try again."); } }} onDeleteSession={async (sessionId) => { try { await deleteAnalysisSession(sessionId); await refresh(); } catch (error) { Alert.alert("Could not delete analysis", error instanceof Error ? error.message : "Try again."); } }} />;
}
