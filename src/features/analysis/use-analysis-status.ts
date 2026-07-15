import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

import { getAnalysisStatus } from "./api";

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

export function useAnalysisStatus(sessionId: string) {
  return useQuery({
    queryKey: ["analysis-status", sessionId],
    queryFn: async ({ signal }) => {
      const accessToken = await getAccessToken();
      return getAnalysisStatus({ accessToken, sessionId, signal });
    },
    enabled: Boolean(sessionId),
    retry: 2,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && terminalStatuses.has(status) ? false : 2_000;
    },
  });
}
