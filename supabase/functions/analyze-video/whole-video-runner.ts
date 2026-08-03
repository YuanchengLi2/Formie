export type WholeVideoPipelineSession = {
  id: string;
  durationMs: number;
  stage: string | null;
  analysisDecision: Record<string, unknown> | null;
  finalResult: Record<string, unknown> | null;
};

export type WholeVideoPipelineDependencies = {
  analyzeWholeVideo: (input: { sessionId: string; durationMs: number }) => Promise<Record<string, unknown>>;
  saveAnalysis: (sessionId: string, decision: Record<string, unknown>) => Promise<void>;
  assembleResult: (decision: Record<string, unknown>) => Record<string, unknown>;
  saveResult: (sessionId: string, result: Record<string, unknown>) => Promise<void>;
};

export async function advanceWholeVideoPipeline(
  session: WholeVideoPipelineSession,
  dependencies: WholeVideoPipelineDependencies,
) {
  if (session.finalResult) {
    return { status: String(session.finalResult.status ?? "complete"), stage: "complete", result: session.finalResult };
  }

  let decision = session.analysisDecision;
  if (!decision) {
    // analyzeWholeVideo returns a validated decision. Its stage lease must not
    // be completed until parsing has succeeded, so malformed raw model output
    // can be retried instead of being replayed from a successful lease.
    decision = await dependencies.analyzeWholeVideo({ sessionId: session.id, durationMs: session.durationMs });
    await dependencies.saveAnalysis(session.id, decision);
  }

  const result = dependencies.assembleResult(decision);
  await dependencies.saveResult(session.id, result);
  return { status: String(result.status ?? "complete"), stage: "complete", result };
}
