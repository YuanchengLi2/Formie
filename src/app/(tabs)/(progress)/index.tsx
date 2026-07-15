import { type Href, useRouter } from "expo-router";

import { groupAnalysisSessions } from "@/features/progress/group-sessions";
import { useAnalysisHistory } from "@/features/progress/use-analysis-history";
import { ProgressScreen } from "@/screens/progress";

export default function ProgressRoute() {
  const router = useRouter();
  const history = useAnalysisHistory();
  return <ProgressScreen groups={groupAnalysisSessions(history.data ?? [])} onOpenSession={(sessionId) => router.push(`/results/${sessionId}` as Href)} />;
}
