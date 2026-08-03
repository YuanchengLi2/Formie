import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { queryClient } from "@/lib/query-client";
import { invalidateAnalysisHistory } from "@/features/progress/history-cache";
import { getAccessToken } from "@/features/auth/access-token";
import { deviceVideoStore } from "@/features/capture/device-video-store";

import { AnalysisApiError, getAnalysisStatus, processAnalysis } from "./api";
import { analysisRefetchInterval } from "./analysis-polling";

export function useAnalysisStatus(sessionId: string, options: { includeVideoUrl?: boolean; mode?: "process" | "status" } = {}) {
  const includeVideoUrl = options.includeVideoUrl ?? false;
  const mode = options.mode ?? "process";
  const queryKey = useMemo(() => ["analysis-status", sessionId, includeVideoUrl, mode] as const, [includeVideoUrl, mode, sessionId]);
  const startedSession = useRef<string | null>(null);

  useEffect(() => {
    if (mode !== "process" || !sessionId || startedSession.current === sessionId) return;
    startedSession.current = sessionId;
    void getAccessToken()
      .then((accessToken) => processAnalysis({ accessToken, sessionId }))
      .then(() => queryClient.invalidateQueries({ queryKey }))
      .catch((error) => {
        if (error instanceof AnalysisApiError && error.code === "DECLARED_CONTEXT_MISMATCH") return;
        // The status query remains the public source of truth and surfaces
        // durable retry state while this kickoff request continues separately.
      });
  }, [mode, queryKey, sessionId]);

  return useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const accessToken = await getAccessToken();
      let response = await getAnalysisStatus({ accessToken, sessionId, signal });
      if (response.result) await invalidateAnalysisHistory(queryClient);
      if (includeVideoUrl) {
        const localRecording = await deviceVideoStore.find(sessionId);
        if (localRecording) response = { ...response, videoUrl: localRecording.localUri };
      }
      return response;
    },
    enabled: Boolean(sessionId),
    retry: 2,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return analysisRefetchInterval(status, query.state.data?.analysisNextRetryAt);
    },
  });
}
