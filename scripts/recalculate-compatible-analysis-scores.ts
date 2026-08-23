import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";

import { scoreForIssueIds, scoreIssues, type ScoredIssueInput } from "../supabase/functions/_shared/issue-score";

type JsonRecord = Record<string, unknown>;
export type StageRow = { session_id: string; pipeline_version: string; input_checksum: string; stage: "analyzing" | "finalizing"; output: unknown; updated_at: string };
type StageGroup = { analyzing: StageRow[]; finalizing: StageRow[] };
export type CompatibleStagePair = {
  sessionId: string;
  pipelineVersion: string;
  inputChecksum: string;
  analyzingOutput: unknown;
  finalizingOutput: unknown;
};
type CompatibleResult = {
  score: number;
  movementScores: { id: string; label: string; score: number; observed: string; evidenceIds: string[] }[];
  scoreRationale: JsonRecord[];
};

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function canonicalJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  const object = record(value);
  if (!object) return value;
  return Object.fromEntries(
    Object.keys(object)
      .sort()
      .map((key) => [key, canonicalJsonValue(object[key])]),
  );
}

export function jsonValuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalJsonValue(left)) === JSON.stringify(canonicalJsonValue(right));
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

export function compatibleStagePairs(stageRows: readonly StageRow[]): CompatibleStagePair[] {
  const grouped = new Map<string, StageGroup>();
  for (const raw of stageRows) {
    const groupKey = `${raw.session_id}:${raw.pipeline_version}:${raw.input_checksum}`;
    const current = grouped.get(groupKey) ?? { analyzing: [], finalizing: [] };
    current[raw.stage].push(raw);
    grouped.set(groupKey, current);
  }
  const candidates: (CompatibleStagePair & { updatedAt: string })[] = [];
  for (const stages of grouped.values()) {
    const finalizing = stages.finalizing.find((stage) => analysisFrom(stage.output) && writingFrom(stage.output));
    if (!finalizing) continue;
    // A successful finalizing payload is self-contained: it stores the analyst
    // evidence and the writer movement mapping from the same attempt. Do not
    // join it to an analyzing row, whose checksum intentionally describes a
    // different stage input.
    candidates.push({
      sessionId: finalizing.session_id,
      pipelineVersion: finalizing.pipeline_version,
      inputChecksum: finalizing.input_checksum,
      analyzingOutput: finalizing.output,
      finalizingOutput: finalizing.output,
      updatedAt: finalizing.updated_at,
    });
  }
  candidates.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const seenSessions = new Set<string>();
  return candidates.filter((candidate) => {
    if (seenSessions.has(candidate.sessionId)) return false;
    seenSessions.add(candidate.sessionId);
    return true;
  }).map(({ updatedAt: _updatedAt, ...candidate }) => candidate);
}

export function hasScoreApplyConfirmation(args: readonly string[]): boolean {
  return args.includes("--apply") && args.includes("--confirm-rubric=severity-v1");
}

export type ScoreRecalculationSummary = {
  scanned: number;
  compatible: number;
  changed: number;
  unchanged: number;
  skipped: number;
  updated: number;
  oldScoreRange: { min: number; max: number } | null;
  newScoreRange: { min: number; max: number } | null;
};

export async function recalculateCompatibleAnalysisScores(options: { apply: boolean; confirmed?: boolean; client: SupabaseClient }): Promise<ScoreRecalculationSummary> {
  if (options.apply && !options.confirmed) throw new Error("Applying score recalculation requires --confirm-rubric=severity-v1.");
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
  const scanned = new Set(stageRows.map((row) => `${row.session_id}:${row.pipeline_version}:${row.input_checksum}`)).size;
  const pairs = compatibleStagePairs(stageRows);
  const sessionIds = Array.from(new Set(pairs.map((pair) => pair.sessionId)));
  const currentResults = new Map<string, { score: number | null; movement_scores: unknown; score_rationale: unknown }>();
  for (let offset = 0; offset < sessionIds.length; offset += 200) {
    const chunk = sessionIds.slice(offset, offset + 200);
    const { data, error } = await options.client
      .from("analysis_results")
      .select("session_id,score,movement_scores,score_rationale")
      .in("session_id", chunk);
    if (error) throw error;
    for (const row of data ?? []) currentResults.set(String(row.session_id), row as { score: number | null; movement_scores: unknown; score_rationale: unknown });
  }
  let compatible = 0;
  let changed = 0;
  let unchanged = 0;
  let updated = 0;
  const oldScores: number[] = [];
  const newScores: number[] = [];
  for (const pair of pairs) {
    const result = compatibleResult(pair.analyzingOutput, pair.finalizingOutput);
    if (!result) continue;
    const current = currentResults.get(pair.sessionId);
    if (!current) continue;
    compatible += 1;
    const isChanged = Number(current.score) !== result.score
      || !jsonValuesEqual(current.movement_scores ?? [], result.movementScores)
      || !jsonValuesEqual(current.score_rationale ?? [], result.scoreRationale);
    if (!isChanged) {
      unchanged += 1;
      continue;
    }
    changed += 1;
    if (typeof current.score === "number") oldScores.push(current.score);
    newScores.push(result.score);
    if (!options.apply) continue;
    const { error } = await options.client.from("analysis_results").update({
      score: result.score,
      movement_scores: result.movementScores,
      score_rationale: result.scoreRationale,
    }).eq("session_id", pair.sessionId);
    if (error) throw error;
    updated += 1;
  }
  const range = (values: number[]) => values.length > 0 ? { min: Math.min(...values), max: Math.max(...values) } : null;
  return {
    scanned,
    compatible,
    changed,
    unchanged,
    skipped: scanned - compatible,
    updated,
    oldScoreRange: range(oldScores),
    newScoreRange: range(newScores),
  };
}

async function main() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Set SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.");
  const apply = process.argv.includes("--apply");
  const confirmed = hasScoreApplyConfirmation(process.argv.slice(2));
  const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const summary = await recalculateCompatibleAnalysisScores({ apply, confirmed, client });
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...summary }));
}

if (process.argv[1] && import.meta.url && fileURLToPath(import.meta.url) === process.argv[1]) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Score recalculation failed");
    process.exitCode = 1;
  });
}
