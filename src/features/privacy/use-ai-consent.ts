import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/auth-provider";
import { supabase } from "@/lib/supabase";

import {
  acceptAiProcessingConsent,
  currentAiProcessingConsent,
  isCurrentAiProcessingConsent,
  revokeAiProcessingConsent,
  type AiConsentClient,
  type AiProcessingConsent,
} from "./ai-consent";

export type AiConsentState = {
  status: "loading" | "ready" | "error";
  current: boolean;
  version: string | null;
  error: string | null;
  accept(): Promise<void>;
  revoke(): Promise<void>;
  refresh(): Promise<void>;
};

const consentClient = supabase as unknown as AiConsentClient;
const pendingOperations = new Map<string, Promise<void>>();

export function runAiConsentOperationOnce(key: string, task: () => Promise<void>): Promise<void> {
  const existing = pendingOperations.get(key);
  if (existing) return existing;
  const pending = task().finally(() => pendingOperations.delete(key));
  pendingOperations.set(key, pending);
  return pending;
}

export function aiConsentQueryKey(userId: string) {
  return ["ai-processing-consent", userId] as const;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useAiConsent(): AiConsentState {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const userId = auth.phase === "authenticated" ? auth.user?.id ?? null : null;
  const [mutationError, setMutationError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: userId ? aiConsentQueryKey(userId) : ["ai-processing-consent", "signed-out"],
    queryFn: () => currentAiProcessingConsent(consentClient),
    enabled: Boolean(userId),
  });

  const runOnce = useCallback(async (operation: "accept" | "revoke", task: () => Promise<void>) => {
    if (!userId) throw new Error("Sign in before changing AI processing consent.");
    const key = `${userId}:${operation}`;
    return runAiConsentOperationOnce(key, task);
  }, [userId]);

  const accept = useCallback(() => runOnce("accept", async () => {
    setMutationError(null);
    try {
      const consent = await acceptAiProcessingConsent(consentClient);
      queryClient.setQueryData<AiProcessingConsent | null>(aiConsentQueryKey(userId!), consent);
      await queryClient.invalidateQueries({ queryKey: aiConsentQueryKey(userId!), refetchType: "active" });
    } catch (error) {
      setMutationError(errorMessage(error, "AI processing consent could not be saved. Try again."));
      throw error;
    }
  }), [queryClient, runOnce, userId]);

  const revoke = useCallback(() => runOnce("revoke", async () => {
    setMutationError(null);
    try {
      await revokeAiProcessingConsent(consentClient);
      queryClient.setQueryData<AiProcessingConsent | null>(aiConsentQueryKey(userId!), null);
      await queryClient.invalidateQueries({ queryKey: aiConsentQueryKey(userId!), refetchType: "active" });
    } catch (error) {
      setMutationError(errorMessage(error, "AI processing consent could not be withdrawn. Try again."));
      throw error;
    }
  }), [queryClient, runOnce, userId]);

  const refresh = useCallback(async () => {
    setMutationError(null);
    if (userId) await query.refetch();
  }, [query, userId]);

  const queryError = query.error ? errorMessage(query.error, "AI processing consent could not be loaded. Try again.") : null;
  return {
    status: !userId ? "ready" : query.isPending ? "loading" : query.isError || mutationError ? "error" : "ready",
    current: isCurrentAiProcessingConsent(query.data ?? null),
    version: query.data?.version ?? null,
    error: mutationError ?? queryError,
    accept,
    revoke,
    refresh,
  };
}
