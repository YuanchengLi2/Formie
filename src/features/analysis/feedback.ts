type RpcError = { message: string } | null;
type Rpc = (functionName: string, arguments_: Record<string, unknown>) => Promise<{ error: RpcError }>;

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
