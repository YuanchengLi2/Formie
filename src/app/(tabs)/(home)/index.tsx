import { HomeScreen } from "@/screens/home";
import { useAnalysisHistory } from "@/features/progress/use-analysis-history";
import { type Href, useRouter } from "expo-router";

export default function HomeRoute() {
  const router = useRouter();
  const history = useAnalysisHistory();
  const recentAnalyses = (history.data ?? []).slice(0, 3).map((item) => ({
    sessionId: item.sessionId,
    status: item.status,
    label: item.status === "processing" ? "Analyzing set" : item.correctedLabel ?? item.detectedLabel ?? "Unidentified movement",
    createdAt: item.createdAt,
    score: item.score,
    exerciseFamily: item.exerciseFamily,
  }));
  return <HomeScreen onRecord={() => router.push("/recording-tips")} historyResolved={!history.isLoading} recentAnalyses={recentAnalyses} onOpenSession={(sessionId, status) => router.push(`/${status === "processing" ? "analysis" : "results"}/${sessionId}` as Href)} onOpenProfile={() => router.push("/(tabs)/(profile)")} />;
}
