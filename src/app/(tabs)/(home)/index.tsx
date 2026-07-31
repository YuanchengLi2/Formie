import { HomeScreen } from "@/screens/home";
import { useAnalysisHistory } from "@/features/progress/use-analysis-history";
import { useProgressMetrics } from "@/features/progress/use-progress-metrics";
import { type Href, useRouter } from "expo-router";

export default function HomeRoute() {
  const router = useRouter();
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
  return <HomeScreen historyResolved={!history.isLoading} recentAnalyses={recentAnalyses} metrics={metrics.data ?? null} metricsLoading={metrics.isLoading} onOpenSession={(sessionId, status) => router.push(`/${status === "processing" || status === "failed" ? "analysis" : "results"}/${sessionId}` as Href)} onOpenProfile={() => router.push("/(tabs)/(profile)")} onOpenCoach={() => router.push("/(tabs)/(coach)")} onOpenProgress={() => router.push("/(tabs)/(progress)")} />;
}
