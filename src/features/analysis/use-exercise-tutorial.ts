import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

import { getExerciseTutorial } from "./api";

async function accessToken(): Promise<string> {
  const session = await supabase.auth.getSession();
  if (!session.data.session?.access_token) throw new Error("Your private session expired. Please reopen Formie.");
  return session.data.session.access_token;
}

export function useExerciseTutorial(sessionId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["exercise-tutorial", sessionId],
    queryFn: async ({ signal }) => getExerciseTutorial({ accessToken: await accessToken(), sessionId, signal }),
    enabled: Boolean(sessionId) && enabled,
    staleTime: Infinity,
    retry: 1,
  });
}
