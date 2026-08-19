import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";

import { scoreForIssueIds, scoreIssues, type ScoredIssueInput } from "../supabase/functions/_shared/issue-score";

type JsonRecord = Record<string, unknown>;
type StageRow = { session_id: string; pipeline_version: string; input_checksum: string; stage: "analyzing" | "finalizing"; output: unknown; updated_at: string };
type StageGroup = { analyzing: StageRow[]; finalizing: StageRow[] };
type CompatibleResult = {
  score: number;
  movementScores: { id: string; label: string; score: number; observed: string; evidenceIds: string[] }[];
  scoreRationale: JsonRecord[];
};

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function analysisFrom(value: unknown): JsonRecord | null {
  const root = record(value);
  if (!root) return null;
  if (Array.isArray(root.issues)) return root;
  return analysisFrom(root.analysis) ?? analysisFrom(root.analysis_draft);
}

function writingFrom(value: unknown): JsonRecord | null {
  const root = record(value);
  if (!root) return null;
  if (Array.isArray(root.movementScores)) return root;
  return writingFrom(root.writing) ?? writingFrom(root.analysis_draft);
}

function completeIssueSet(value: unknown): (ScoredIssueInput & { observation: string; evidenceIds: string[] })[] | null {
  if (!Array.isArray(value)) return null;
  const ids = new Set<string>();
  const issues: (ScoredIssueInput & { observation: string; evidenceIds: string[] })[] = [];
  for (const raw of value) {
    const issue = record(raw);
    const evidence = issue?.evidence;
    if (!issue || typeof issue.id !== "string" || !issue.id.trim() || ids.has(issue.id)) return null;
    if (!(["note", "important", "high"] as string[]).includes(String(issue.severity))) return null;
    if (!(["isolated", "repeated", "throughout"] as string[]).includes(String(issue.prevalence))) return null;
    if (typeof issue.confidence !== "number" || !Number.isFinite(issue.confidence) || issue.confidence < 0 || issue.confidence > 1) return null;
    if (!Array.isArray(evidence) || evidence.length === 0) return null;
    const evidenceIds = evidence.flatMap((moment) => {
      const item = record(moment);
      return typeof item?.peakMs === "number" ? [`${issue.id}:${item.peakMs}`] : [];
    });
    if (evidenceIds.length === 0) return null;
    ids.add(issue.id);
    issues.push({
      id: issue.id,
      severity: issue.severity as ScoredIssueInput["severity"],
      prevalence: issue.prevalence as ScoredIssueInput["prevalence"],
      confidence: issue.confidence,
      observation: typeof issue.observation === "string" && issue.observation.trim() ? issue.observation : "Observed issue from the complete video.",
      evidenceIds,
    });
  }
  return issues;
}

export function compatibleResult(analyzingOutput: unknown, finalizingOutput: unknown): CompatibleResult | null {
  const finalizingWriting = writingFrom(finalizingOutput);
  const analysis = analysisFrom(finalizingOutput) ?? analysisFrom(analyzingOutput);
  const issues = completeIssueSet(analysis?.issues);
  const rawMovementScores = finalizingWriting?.movementScores;
  if (!issues || !Array.isArray(rawMovementScores)) return null;
  const issueInputs = issues.map(({ observation: _observation, evidenceIds: _evidenceIds, ...issue }) => issue);
  const overall = scoreIssues(issueInputs);
  const issueIds = new Set(issues.map((issue) => issue.id));
  const movementScores = [] as CompatibleResult["movementScores"];
  for (const raw of rawMovementScores) {
    const movement = record(raw);
    if (!movement || typeof movement.id !== "string" || typeof movement.label !== "string" || typeof movement.observed !== "string" || !Array.isArray(movement.evidenceIds) || movement.evidenceIds.some((id) => typeof id !== "string" || !issueIds.has(id))) return null;
    movementScores.push({
      id: movement.id,
      label: movement.label,
      observed: movement.observed,
      evidenceIds: movement.evidenceIds as string[],
      score: scoreForIssueIds(issueInputs, movement.evidenceIds as string[]).score,
    });
  }
  if (movementScores.length === 0) return null;
  const detailById = new Map(overall.issues.map((detail) => [detail.issueId, detail]));
  return {
    score: overall.score,
    movementScores,
    scoreRationale: issues.map((issue) => {
      const detail = detailById.get(issue.id)!;
      return {
        criterion: issue.id,
        observed: issue.observation,
        impact: detail.penalty,
        confidence: detail.scoringConfidence,
        evidenceIds: issue.evidenceIds,
        severity: detail.severity,
        prevalence: detail.prevalence,
        scoringConfidence: detail.scoringConfidence,
        penalty: detail.penalty,
        rubricVersion: detail.rubricVersion,
      };
    }),
  };
}

export async function recalculateCompatibleAnalysisScores(options: { apply: boolean; client: SupabaseClient }): Promise<{ scanned: number; compatible: number; updated: number }> {
  const pageSize = 1_000;
  const stageRows: StageRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await options.client
      .from("analysis_stage_runs")
      .select("session_id,pipeline_version,input_checksum,stage,output,updated_at")
      .eq("status", "succeeded")
      .in("stage", ["analyzing", "finalizing"])
      .not("output", "is", null)
      .order("updated_at", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as StageRow[];
    stageRows.push(...page);
    if (page.length < pageSize) break;
  }
  const grouped = new Map<string, StageGroup>();
  for (const raw of stageRows) {
    const groupKey = `${raw.session_id}:${raw.pipeline_version}`;
    const current = grouped.get(groupKey) ?? { analyzing: [], finalizing: [] };
    current[raw.stage].push(raw);
    grouped.set(groupKey, current);
  }
  let compatible = 0;
  let updated = 0;
  for (const stages of grouped.values()) {
    const analyzingOutput = stages.analyzing.find((stage) => analysisFrom(stage.output))?.output;
    const finalizingOutput = stages.finalizing.find((stage) => analysisFrom(stage.output) && writingFrom(stage.output))?.output;
    const result = compatibleResult(analyzingOutput, finalizingOutput);
    if (!result) continue;
    compatible += 1;
    if (!options.apply) continue;
    const sessionId = stages.finalizing[0]?.session_id ?? stages.analyzing[0]?.session_id;
    if (!sessionId) continue;
    const { error } = await options.client.from("analysis_results").update({
      score: result.score,
      movement_scores: result.movementScores,
      score_rationale: result.scoreRationale,
    }).eq("session_id", sessionId);
    if (error) throw error;
    updated += 1;
  }
  return { scanned: grouped.size, compatible, updated };
}

async function main() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Set SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.");
  const apply = process.argv.includes("--apply");
  const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const summary = await recalculateCompatibleAnalysisScores({ apply, client });
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...summary }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Score recalculation failed");
    process.exitCode = 1;
  });
}
