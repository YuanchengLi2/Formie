type RpcError = { message: string } | null;
type Rpc = (functionName: string, arguments_: Record<string, unknown>) => Promise<{ error: RpcError }>;
type FeedbackRow = { helpful: boolean };
type FeedbackRead = (sessionId: string) => Promise<{ data: FeedbackRow | null; error: RpcError }>;

export function createAnalysisFeedbackReader(read: FeedbackRead) {
  return async (sessionId: string): Promise<boolean | null> => {
    const { data, error } = await read(sessionId);
    if (error) throw new Error(error.message);
    return data?.helpful ?? null;
  };
}

export function createAnalysisFeedbackSubmitter(rpc: Rpc) {
  return async (sessionId: string, helpful: boolean): Promise<void> => {
    const { error } = await rpc("submit_analysis_feedback", { p_session_id: sessionId, p_helpful: helpful });
    if (error) throw new Error(error.message);
  };
}

export async function submitAnalysisFeedback(sessionId: string, helpful: boolean): Promise<void> {
  const { supabase } = await import("@/lib/supabase");
  const submit = createAnalysisFeedbackSubmitter(async (functionName, arguments_) => {
    const { error } = await supabase.rpc(functionName, arguments_);
    return { error };
  });
  await submit(sessionId, helpful);
}

export async function getAnalysisFeedback(sessionId: string): Promise<boolean | null> {
  const { supabase } = await import("@/lib/supabase");
  const read = createAnalysisFeedbackReader(async (ownedSessionId) => {
    const { data, error } = await supabase
      .from("analysis_feedback")
      .select("helpful")
      .eq("session_id", ownedSessionId)
      .maybeSingle();
    return { data: data as FeedbackRow | null, error };
  });
  return read(sessionId);
}
