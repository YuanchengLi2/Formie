import { useAnalysisHistory } from "@/features/progress/use-analysis-history";
import { CoachComingSoonScreen } from "@/screens/coach/coach-coming-soon";

export default function CoachRoute() {
  const history = useAnalysisHistory();
  const videos = (history.data ?? []).filter((item) => item.status === "complete" || item.status === "partial");
  return <CoachComingSoonScreen videos={videos} />;
}
