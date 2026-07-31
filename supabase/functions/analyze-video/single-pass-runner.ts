import type { FactualContradiction } from "../_shared/single-pass-analysis.ts";

export type SinglePassPipelineSession = {
  id: string;
  durationMs: number;
  file: { uri: string; mimeType: string };
  analysisDecision: Record<string, unknown> | null;
  writerCopy: Record<string, unknown> | null;
  contradictions: FactualContradiction[];
  finalResult: Record<string, unknown> | null;
};

export type SinglePassPipelineDependencies = {
  localizeMovement: (input: {
    sessionId: string;
    file: SinglePassPipelineSession["file"];
    durationMs: number;
  }) => Promise<Record<string, unknown>>;
  analyze: (input: {
    sessionId: string;
    file: SinglePassPipelineSession["file"];
    durationMs: number;
    movementLocalization: Record<string, unknown>;
  }) => Promise<{
    decision: Record<string, unknown>;
    contradictions: FactualContradiction[];
  }>;
  confirmUnable: (input: {
    sessionId: string;
    file: SinglePassPipelineSession["file"];
    durationMs: number;
    decision: Record<string, unknown>;
    movementLocalization: Record<string, unknown>;
  }) => Promise<{
    decision: Record<string, unknown>;
    contradictions: FactualContradiction[];
  }>;
  writeAndAudit: (input: { sessionId: string; decision: Record<string, unknown>; durationMs: number }) => Promise<{
    writerCopy: Record<string, unknown> | null;
    contradictions: FactualContradiction[];
  }>;
  reviewContradictions: (input: {
    sessionId: string;
    file: SinglePassPipelineSession["file"];
    durationMs: number;
    decision: Record<string, unknown>;
    writerCopy: Record<string, unknown> | null;
    contradictions: FactualContradiction[];
  }) => Promise<{
    decision: Record<string, unknown>;
    writerCopy: Record<string, unknown> | null;
  }>;
  setStage: (sessionId: string, stage: string) => Promise<void>;
  saveAnalysis: (
    sessionId: string,
    decision: Record<string, unknown>,
    copy: Record<string, unknown> | null,
    contradictions: FactualContradiction[],
  ) => Promise<void>;
  assembleResult: (decision: Record<string, unknown>, copy: Record<string, unknown> | null) => Record<string, unknown>;
  saveResult: (sessionId: string, result: Record<string, unknown>) => Promise<void>;
};

export async function advanceSinglePassPipeline(session: SinglePassPipelineSession, dependencies: SinglePassPipelineDependencies) {
  if (session.finalResult) return { status: String(session.finalResult.status ?? "complete"), stage: "complete", result: session.finalResult };
  const decision = session.analysisDecision;
  const writerCopy = session.writerCopy;
  const contradictions = session.contradictions;

  if (!decision) {
    const movementLocalization = await dependencies.localizeMovement({
      sessionId: session.id,
      file: session.file,
      durationMs: session.durationMs,
    });
    let analyzed = await dependencies.analyze({
      sessionId: session.id,
      file: session.file,
      durationMs: session.durationMs,
      movementLocalization,
    });
    if (String(analyzed.decision.status) === "unable") {
      analyzed = await dependencies.confirmUnable({
        sessionId: session.id,
        file: session.file,
        durationMs: session.durationMs,
        decision: analyzed.decision,
        movementLocalization,
      });
      if (String(analyzed.decision.status) === "unable" && String(movementLocalization.outcome) === "movement_found") {
        throw Object.assign(new Error("The temporal movement pass found exercise repetitions, but the analyst returned unable"), {
          code: "ANALYSIS_MOVEMENT_CONTRADICTION",
        });
      }
    }
    await dependencies.saveAnalysis(session.id, analyzed.decision, null, analyzed.contradictions);
    return { status: "processing", stage: "checking_consistency" };
  }

  if (String(decision.status) === "unable") {
    const result = dependencies.assembleResult(decision, null);
    await dependencies.saveResult(session.id, result);
    return { status: String(result.status ?? "unable"), stage: "complete", result };
  }

  if (String(decision.status) !== "unable" && !writerCopy) {
    await dependencies.setStage(session.id, "checking_consistency");
    const written = await dependencies.writeAndAudit({
      sessionId: session.id,
      decision,
      durationMs: session.durationMs,
    });
    const combinedContradictions = [...contradictions, ...written.contradictions].slice(0, 8);
    await dependencies.saveAnalysis(session.id, decision, written.writerCopy, combinedContradictions);
    if (combinedContradictions.length > 0) {
      await dependencies.setStage(session.id, "double_checking");
      return { status: "processing", stage: "double_checking" };
    }
    const result = dependencies.assembleResult(decision, written.writerCopy);
    await dependencies.saveResult(session.id, result);
    return { status: String(result.status ?? "complete"), stage: "complete", result };
  }

  if (contradictions.length > 0) {
    await dependencies.setStage(session.id, "double_checking");
    const reviewed = await dependencies.reviewContradictions({
      sessionId: session.id,
      file: session.file,
      durationMs: session.durationMs,
      decision,
      writerCopy,
      contradictions,
    });
    await dependencies.saveAnalysis(session.id, reviewed.decision, reviewed.writerCopy, []);
    const result = dependencies.assembleResult(reviewed.decision, reviewed.writerCopy);
    await dependencies.saveResult(session.id, result);
    return { status: String(result.status ?? "complete"), stage: "complete", result };
  }

  const result = dependencies.assembleResult(decision, writerCopy);
  await dependencies.saveResult(session.id, result);
  return { status: String(result.status ?? "complete"), stage: "complete", result };
}
