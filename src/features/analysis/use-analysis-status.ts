import { useQuery } from "@tanstack/react-query";

import { queryClient } from "@/lib/query-client";
import { invalidateAnalysisHistory } from "@/features/progress/history-cache";
import { getAccessToken } from "@/features/auth/access-token";

import { getAnalysisStatus, processAndLoadAnalysis } from "./api";

const terminalStatuses = new Set(["complete", "partial", "unable", "failed"]);

export function useAnalysisStatus(sessionId: string, options: { includeVideoUrl?: boolean; mode?: "process" | "status" } = {}) {
  const includeVideoUrl = options.includeVideoUrl ?? false;
  const mode = options.mode ?? "process";
  return useQuery({
    queryKey: ["analysis-status", sessionId, includeVideoUrl, mode],
    queryFn: async ({ signal }) => {
      const accessToken = await getAccessToken();
      const response = mode === "status"
        ? await getAnalysisStatus({ accessToken, sessionId, signal })
        : await processAndLoadAnalysis({ accessToken, sessionId, signal, includeVideoUrl });
      if (response.result) await invalidateAnalysisHistory(queryClient);
      return response;
    },
    enabled: Boolean(sessionId),
    retry: 2,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && terminalStatuses.has(status) ? false : 750;
    },
  });
}
