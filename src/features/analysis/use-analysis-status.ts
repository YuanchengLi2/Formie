import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/query-client";
import { invalidateAnalysisHistory } from "@/features/progress/history-cache";

import { processAndLoadAnalysis } from "./api";

const terminalStatuses = new Set(["complete", "partial", "unable", "failed"]);

async function getAccessToken(): Promise<string> {
  const existing = await supabase.auth.getSession();
  if (existing.data.session?.access_token) return existing.data.session.access_token;

  const created = await supabase.auth.signInAnonymously();
  if (created.error || !created.data.session?.access_token) {
    throw new Error(created.error?.message ?? "A private session could not be created");
  }
  return created.data.session.access_token;
}

export function useAnalysisStatus(sessionId: string, options: { includeVideoUrl?: boolean } = {}) {
  const includeVideoUrl = options.includeVideoUrl ?? false;
  return useQuery({
    queryKey: ["analysis-status", sessionId, includeVideoUrl],
    queryFn: async ({ signal }) => {
      const accessToken = await getAccessToken();
      const response = await processAndLoadAnalysis({ accessToken, sessionId, signal, includeVideoUrl });
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
