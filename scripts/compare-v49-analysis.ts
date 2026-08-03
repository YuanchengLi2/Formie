import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

import { analysisResultSchema } from "../src/features/analysis/result-schema";

export type ExpectedConcept = { id: string; label: string; terms: string[] };
export type Benchmark = { name: string; sessionId: string; expectedConcepts: ExpectedConcept[] };
export type ComparisonFixture = { benchmarks: Benchmark[]; genericFallbackPatterns: string[] };

export function expectedConceptsForSession(fixture: ComparisonFixture, sessionId: string): ExpectedConcept[] {
  return fixture.benchmarks.find((entry) => entry.sessionId === sessionId)?.expectedConcepts ?? [];
}

const normalizedText = (value: unknown) => JSON.stringify(value ?? "").toLocaleLowerCase();

export function evaluateV49Comparison(input: {
  oldResult: unknown;
  problemOutput: Record<string, unknown>;
  publicResult: Record<string, unknown> | null;
  expectedConcepts: ExpectedConcept[];
  genericFallbackPatterns: string[];
  telemetry: Array<Record<string, unknown>>;
}) {
  const problemText = normalizedText(input.problemOutput.problems);
  const publicResult = input.publicResult ?? {};
  const publicText = normalizedText(publicResult);
  const coverage = input.expectedConcepts.map((concept) => ({
    id: concept.id,
    label: concept.label,
    found: concept.terms.some((term) => problemText.includes(term.toLocaleLowerCase())),
  }));
  const problems = Array.isArray(input.problemOutput.problems) ? input.problemOutput.problems : [];
  const expectedHits = new Set(input.expectedConcepts.flatMap((concept) => concept.terms).filter((term) => problemText.includes(term.toLocaleLowerCase())));
  const unrelatedFindings = problems.filter((problem) => {
    const text = normalizedText(problem);
    return input.expectedConcepts.every((concept) => concept.terms.every((term) => !text.includes(term.toLocaleLowerCase())));
  });
  const corrections = Array.isArray(publicResult.priorityCorrections) ? publicResult.priorityCorrections as Array<Record<string, unknown>> : [];
  const nextSetPlan = Array.isArray(publicResult.nextSetPlan) ? publicResult.nextSetPlan as Array<Record<string, unknown>> : [];
  const recognition = publicResult.recognition as Record<string, unknown> | undefined;
  const exerciseTerms = [recognition?.label, ...(Array.isArray(recognition?.equipment) ? recognition.equipment : [])]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 2)
    .map((value) => value.toLocaleLowerCase());
  const specificity = corrections.map((correction) => {
    const related = nextSetPlan.find((item) => item.relatedFindingId === correction.id);
    const coaching = normalizedText((correction.expandedCoaching as Record<string, unknown> | undefined)?.whatToDo ?? correction.correction);
    const next = normalizedText(related?.action);
    return {
      problemId: correction.id,
      whatToDoNamesExerciseOrEquipment: exerciseTerms.some((term) => coaching.includes(term)),
      nextSetNamesExerciseOrEquipment: exerciseTerms.some((term) => next.includes(term)),
    };
  });
  const genericFallbacks = input.genericFallbackPatterns.filter((phrase) => publicText.includes(phrase.toLocaleLowerCase()));
  const finderCalls = input.telemetry.filter((call) => call.model === "gemini-3.6-flash");
  const writerCalls = input.telemetry.filter((call) => call.model === "gemini-3.1-flash-lite");
  const clientParse = analysisResultSchema.safeParse(input.publicResult);
  return {
    oldIssues: (input.oldResult as Record<string, unknown> | null)?.priority_corrections ?? [],
    v49Issues: problems,
    coverage,
    missingConcepts: coverage.filter((item) => !item.found),
    unrelatedFindings,
    expectedTermHits: [...expectedHits],
    specificity,
    callCounts: { problemFinder: finderCalls.length, coachingWriter: writerCalls.length },
    clientSchemaValid: clientParse.success,
    clientSchemaIssues: clientParse.success ? [] : clientParse.error.issues,
    genericFallbacks,
  };
}

async function main() {
  const sessionIds = process.argv.slice(2);
  if (sessionIds.length === 0) throw new Error("Usage: tsx scripts/compare-v49-analysis.ts <retained-session-id> [session-id]");
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const shadowSecret = process.env.ANALYSIS_SHADOW_SECRET;
  if (!url || !serviceKey || !shadowSecret) throw new Error("Supabase URL, service-role key, and ANALYSIS_SHADOW_SECRET are required");
  const fixture = JSON.parse(readFileSync(resolve(__dirname, "fixtures/v49-quality-benchmark.json"), "utf8")) as ComparisonFixture;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const reports = [];
  for (const sessionId of sessionIds) {
    const [{ data: session, error: sessionError }, { data: oldResult, error: oldError }] = await Promise.all([
      admin.from("analysis_sessions").select("id,user_id,active_v49_run_id").eq("id", sessionId).single(),
      admin.from("analysis_results").select("*").eq("session_id", sessionId).maybeSingle(),
    ]);
    if (sessionError || oldError) throw sessionError ?? oldError;
    const oldSnapshot = JSON.stringify(oldResult);
    const started = await admin.rpc("start_analysis_v49", { p_session_id: sessionId, p_user_id: session.user_id, p_mode: "shadow" });
    if (started.error || !started.data) throw started.error ?? new Error("Could not create shadow run");
    const runId = String(started.data);
    let terminal = false;
    for (let attempt = 0; attempt < 90 && !terminal; attempt += 1) {
      const response = await fetch(`${url}/functions/v1/analyze-video-v49`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json",
          "x-analysis-shadow-secret": shadowSecret, "x-analysis-shadow-user-id": session.user_id,
        },
        body: JSON.stringify({ sessionId, runId }),
      });
      const body = await response.json() as Record<string, unknown>;
      if (!response.ok && body.code !== "ANALYSIS_CONTRACT_INVALID" && body.code !== "ANALYSIS_DETERMINISTIC_STAGE_FAILED") throw new Error(`Shadow v49 invocation failed (${response.status}): ${JSON.stringify(body)}`);
      if (!response.ok) {
        terminal = true;
        break;
      }
      terminal = ["complete", "unable", "failed"].includes(String(body.status));
      if (!terminal) await new Promise((resolveDelay) => setTimeout(resolveDelay, 2_000));
    }
    const [{ data: run, error: runError }, { data: telemetry, error: telemetryError }, { data: unchangedOld, error: unchangedError }, { data: unchangedSession, error: unchangedSessionError }] = await Promise.all([
      admin.from("analysis_v49_runs").select("status,failure_reason,raw_problem_output,public_result").eq("run_id", runId).single(),
      admin.from("model_call_telemetry").select("model,status,error_code").eq("v49_run_id", runId).order("created_at"),
      admin.from("analysis_results").select("*").eq("session_id", sessionId).maybeSingle(),
      admin.from("analysis_sessions").select("active_v49_run_id").eq("id", sessionId).single(),
    ]);
    if (runError || telemetryError || unchangedError || unchangedSessionError) throw runError ?? telemetryError ?? unchangedError ?? unchangedSessionError;
    if (JSON.stringify(unchangedOld) !== oldSnapshot || unchangedSession.active_v49_run_id !== session.active_v49_run_id) throw new Error("Shadow comparison altered the user-facing result route");
    const expectedConcepts = expectedConceptsForSession(fixture, sessionId);
    reports.push({
      sessionId,
      runId,
      status: run.status,
      failureReason: run.failure_reason,
      ...evaluateV49Comparison({
        oldResult,
        problemOutput: run.raw_problem_output ?? {},
        publicResult: run.public_result,
        expectedConcepts,
        genericFallbackPatterns: fixture.genericFallbackPatterns,
        telemetry: telemetry ?? [],
      }),
    });
  }
  process.stdout.write(`${JSON.stringify(reports, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}
