import { HomeScreen } from "@/screens/home";
import { useAccess } from "@/features/access/access-provider";
import { formatAnalysisBalance } from "@/features/access/account-access";
import { useAnalysisHistory } from "@/features/progress/use-analysis-history";
import { useProgressMetrics } from "@/features/progress/use-progress-metrics";
import { type Href, useRouter } from "expo-router";

export default function HomeRoute() {
  const router = useRouter();
  const access = useAccess();
  const history = useAnalysisHistory();
  const metrics = useProgressMetrics();
  const recentAnalyses = (history.data ?? []).slice(0, 10).map((item) => ({
    sessionId: item.sessionId,
    status: item.status,
    label:
      item.status === "processing"
        ? "Analyzing set"
        : item.status === "failed"
          ? "Analysis needs retry"
          : item.correctedLabel ?? item.detectedLabel ?? "Unidentified movement",
    createdAt: item.createdAt,
    score: item.score,
    exerciseFamily: item.exerciseFamily,
    priorityCorrectionTitles: item.priorityCorrectionTitles,
  }));
  const resetLabel = access.access.status === "active" && access.access.periodEndsAt
    ? `Resets ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(access.access.periodEndsAt))}`
    : null;
  return <HomeScreen historyResolved={!history.isLoading} recentAnalyses={recentAnalyses} metrics={metrics.data ?? null} metricsLoading={metrics.isLoading} analysisBalanceLabel={formatAnalysisBalance(access.access)} analysisResetLabel={resetLabel} onOpenSession={(sessionId, status) => router.push(`/${status === "processing" || status === "failed" ? "analysis" : "results"}/${sessionId}` as Href)} onOpenProfile={() => router.push("/(tabs)/(profile)")} onOpenCoach={() => router.push("/(tabs)/(coach)")} onOpenProgress={() => router.push("/(tabs)/(progress)")} />;
}
