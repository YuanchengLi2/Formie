import { HomeScreen } from "@/screens/home";
import { useAnalysisHistory } from "@/features/progress/use-analysis-history";
import { type Href, useRouter } from "expo-router";

export default function HomeRoute() {
  const router = useRouter();
  const history = useAnalysisHistory();
  const recentAnalyses = (history.data ?? []).slice(0, 3).map((item) => ({
    sessionId: item.sessionId,
    label: item.correctedLabel ?? item.detectedLabel ?? "Unidentified movement",
    createdAt: item.createdAt,
    score: item.score,
    exerciseFamily: item.exerciseFamily,
  }));
  return <HomeScreen onRecord={() => router.push("/recording-tips")} recentAnalyses={recentAnalyses} onOpenSession={(sessionId) => router.push(`/results/${sessionId}` as Href)} onOpenProfile={() => router.push("/(tabs)/(profile)")} />;
}
