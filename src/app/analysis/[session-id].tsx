import { useEffect } from "react";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";

import { useAnalysisStatus } from "@/features/analysis/use-analysis-status";
import { AnalysisProgressScreen } from "@/screens/analysis-progress";

export default function AnalysisProgressRoute() {
  const router = useRouter();
  const { "session-id": sessionId = "" } = useLocalSearchParams<{ "session-id": string }>();
  const status = useAnalysisStatus(sessionId);

  useEffect(() => {
    if (status.data?.result) router.replace(`/results/${sessionId}` as Href);
  }, [router, sessionId, status.data?.result]);

  const failureMessage =
    status.data?.status === "failed"
      ? "Analysis paused. Try again shortly."
      : status.error instanceof Error
        ? status.error.message
        : null;

  return <AnalysisProgressScreen stage={status.data?.stage ?? null} failureMessage={failureMessage} />;
}
