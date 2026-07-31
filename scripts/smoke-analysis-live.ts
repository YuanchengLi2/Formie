import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

import { analysisResultSchema } from "../src/features/analysis/result-schema";
import { createGeminiFilesClient } from "../supabase/functions/_shared/gemini-files.ts";
import { parseSetDeclaration } from "../supabase/functions/_shared/set-declaration.ts";
import { fetchWithTimeout } from "./live-video-request.ts";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const sourceInput = process.argv[2];
if (!sourceInput) throw new Error("Usage: tsx scripts/smoke-analysis-live.ts <source-session-id | video-path> [duration-ms]");
let declaration = process.env.LIVE_SET_DECLARATION_JSON
  ? parseSetDeclaration(JSON.parse(process.env.LIVE_SET_DECLARATION_JSON))
  : null;

const supabaseUrl = required("EXPO_PUBLIC_SUPABASE_URL");
const anonKey = required("EXPO_PUBLIC_SUPABASE_ANON_KEY");
const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const userClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const geminiFiles = createGeminiFilesClient({ apiKey: required("GEMINI_API_KEY") });

async function main() {
  let sourceLabel = sourceInput;
  let durationMs: number;
  let sourceVideo: Blob | Buffer;
  let sourceAnalysisVideo: Blob | Buffer | null = null;
  let sourceFallbackVideo: Blob | Buffer | null = null;
  if (fs.existsSync(path.resolve(sourceInput))) {
    durationMs = Number(process.argv[3]);
    if (!Number.isInteger(durationMs) || durationMs <= 0) throw new Error("A local video requires a positive duration in milliseconds");
    sourceVideo = fs.readFileSync(path.resolve(sourceInput));
    sourceLabel = path.basename(sourceInput);
  } else {
    const source = await admin.from("analysis_sessions").select("video_path,analysis_video_path,analysis_fallback_video_path,analysis_input_strategy,duration_ms,set_declaration").eq("id", sourceInput).single();
    if (source.error || !source.data.video_path || !source.data.duration_ms) throw source.error ?? new Error("Source analysis video is unavailable");
    if (!declaration && source.data.set_declaration) declaration = parseSetDeclaration(source.data.set_declaration);
    const downloaded = await admin.storage.from("analysis-videos").download(source.data.video_path);
    if (downloaded.error) throw downloaded.error;
    durationMs = source.data.duration_ms;
    sourceVideo = downloaded.data;
    if (source.data.analysis_video_path && source.data.analysis_input_strategy === "upright_video") {
      const analysisDownload = await admin.storage.from("analysis-videos").download(source.data.analysis_video_path);
      if (analysisDownload.error) throw analysisDownload.error;
      sourceAnalysisVideo = analysisDownload.data;
    }
    if (source.data.analysis_fallback_video_path) {
      const fallbackDownload = await admin.storage.from("analysis-videos").download(source.data.analysis_fallback_video_path);
      if (fallbackDownload.error) throw fallbackDownload.error;
      sourceFallbackVideo = fallbackDownload.data;
    }
  }

  const nonce = crypto.randomUUID();
  const email = `analysis-smoke-${nonce}@example.invalid`;
  const password = `Sm0ke-${nonce}!`;
  const sessionId = crypto.randomUUID();
  let userId: string | null = null;
  let storagePath: string | null = null;
  let analysisStoragePath: string | null = null;
  let fallbackStoragePath: string | null = null;

  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw created.error ?? new Error("Disposable smoke user was not created");
    userId = created.data.user.id;
    storagePath = `${userId}/${sessionId}/original.mp4`;
    analysisStoragePath = sourceAnalysisVideo ? `${userId}/${sessionId}/analysis-input.mp4` : null;
    fallbackStoragePath = sourceFallbackVideo ? `${userId}/${sessionId}/privacy-safe-upper-body.mp4` : null;

    const uploaded = await admin.storage.from("analysis-videos").upload(storagePath, sourceVideo, { contentType: sourceVideo instanceof Blob ? sourceVideo.type || "video/mp4" : "video/mp4", upsert: false });
    if (uploaded.error) throw uploaded.error;
    if (analysisStoragePath && sourceAnalysisVideo) {
      const analysisUploaded = await admin.storage.from("analysis-videos").upload(analysisStoragePath, sourceAnalysisVideo, {
        contentType: sourceAnalysisVideo instanceof Blob ? sourceAnalysisVideo.type || "video/mp4" : "video/mp4",
        upsert: false,
      });
      if (analysisUploaded.error) throw analysisUploaded.error;
    }
    if (fallbackStoragePath && sourceFallbackVideo) {
      const fallbackUploaded = await admin.storage.from("analysis-videos").upload(fallbackStoragePath, sourceFallbackVideo, {
        contentType: sourceFallbackVideo instanceof Blob ? sourceFallbackVideo.type || "video/mp4" : "video/mp4",
        upsert: false,
      });
      if (fallbackUploaded.error) throw fallbackUploaded.error;
    }
    const inserted = await admin.from("analysis_sessions").insert({
      id: sessionId,
      user_id: userId,
      status: "queued",
      stage: "video_processing",
      video_path: storagePath,
      duration_ms: durationMs,
      recognition_alternatives: [],
      detected_equipment: [],
      analysis_input_strategy: analysisStoragePath ? "upright_video" : "video",
      analysis_video_path: analysisStoragePath,
      analysis_fallback_video_path: fallbackStoragePath,
      analysis_input_variant: "primary",
      analysis_duration_ms: analysisStoragePath ? durationMs : null,
      analysis_source_start_ms: analysisStoragePath ? 0 : null,
      analysis_source_end_ms: analysisStoragePath ? durationMs : null,
      analysis_preprocessing_confidence: analysisStoragePath ? 1 : null,
      set_declaration: declaration,
      exercise_variant_v2_id: declaration?.exercise.catalogExerciseId ?? null,
      detected_label: declaration?.exercise.label ?? null,
      recognition_confidence: declaration ? 1 : 0,
    });
    if (inserted.error) throw inserted.error;

    const signedIn = await userClient.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("Disposable smoke user could not sign in");
    const accessToken = signedIn.data.session.access_token;
    const runAnalysis = async (runLabel: string) => {
      const runStages: string[] = [];
      let runTerminal: Record<string, unknown> | null = null;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/analyze-video`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, apikey: anonKey, "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const body = await response.json() as Record<string, unknown>;
        if (!response.ok) {
          const [{ data: failedSession }, { data: failedTelemetry }] = await Promise.all([
            admin.from("analysis_sessions").select("status,stage,failure_code,pipeline_version,correction_audit_v1,analysis_draft,gemini_file_uri,gemini_file_state,duration_ms").eq("id", sessionId).single(),
            admin.from("model_call_telemetry").select("stage,model,requested_fps,status,error_code").eq("session_id", sessionId).order("created_at"),
          ]);
          const diagnostics = { runLabel, body, stages: runStages, failedSession, failedTelemetry };
          const diagnosticsPath = path.resolve(".expo", `live-analysis-${runLabel}-diagnostic.json`);
          fs.mkdirSync(path.dirname(diagnosticsPath), { recursive: true });
          fs.writeFileSync(diagnosticsPath, `${JSON.stringify(diagnostics, null, 2)}\n`, "utf8");
          throw new Error(`Live analyze-video failed (${response.status}); diagnostics: ${diagnosticsPath}`);
        }
        runStages.push(String(body.stage ?? "unknown"));
        if (["complete", "partial", "unable", "failed"].includes(String(body.status))) {
          runTerminal = body;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
      if (!runTerminal || !["complete", "partial"].includes(String(runTerminal.status))) throw new Error(`Live ${runLabel} analysis did not complete: ${JSON.stringify(runTerminal)}`);
      return { stages: runStages, terminal: runTerminal };
    };
    const freshRun = await runAnalysis("fresh");
    const stages = freshRun.stages;
    analysisResultSchema.parse(freshRun.terminal.result);

    const [{ data: storedSession, error: sessionError }, { data: storedResult, error: resultError }, { data: telemetry, error: telemetryError }] = await Promise.all([
      admin.from("analysis_sessions").select("pipeline_version,correction_audit_v1,analysis_draft,writer_result_v2,detected_label,detected_variation,exercise_family").eq("id", sessionId).single(),
      admin.from("analysis_results").select("score,overall_assessment,coach_note,movement_scores,muscle_focus,equipment_observations,did_well,priority_corrections,coaching_cues,next_set_plan,rep_timeline,exercise_guide,coaching_coverage").eq("session_id", sessionId).single(),
      admin.from("model_call_telemetry").select("stage,model,requested_fps,clip_start_ms,clip_end_ms,status,error_code").eq("session_id", sessionId).order("created_at"),
    ]);
    if (sessionError || resultError || telemetryError) throw sessionError ?? resultError ?? telemetryError;
    if (storedSession.pipeline_version !== "gemini-analyst-coach-v33") throw new Error("Live analysis did not use the latest whole-video analyst-coach pipeline");
    if (storedSession.correction_audit_v1 !== null) throw new Error(`Correction audit metadata should remain unused: ${JSON.stringify(storedSession.correction_audit_v1)}`);
    const draft = storedSession.analysis_draft as Record<string, unknown> | null;
    const wholeSetCoverage = draft?.wholeSetCoverage as Record<string, unknown> | null;
    const movementAnalysis = draft?.movementAnalysis;
    const checkpoints = Array.isArray(wholeSetCoverage?.checkpoints) ? wholeSetCoverage.checkpoints as Record<string, unknown>[] : [];
    const expectedPositions = ["beginning", "middle", "end"];
    if (
      !wholeSetCoverage
      || !Number.isInteger(wholeSetCoverage.activeSetStartMs)
      || !Number.isInteger(wholeSetCoverage.activeSetEndMs)
      || Number(wholeSetCoverage.activeSetStartMs) >= Number(wholeSetCoverage.activeSetEndMs)
      || checkpoints.length !== 3
      || checkpoints.some((checkpoint, index) => checkpoint.position !== expectedPositions[index])
    ) {
      throw new Error(`Whole-set coverage is invalid: ${JSON.stringify(wholeSetCoverage)}`);
    }
    if (
      typeof movementAnalysis !== "string"
      || !movementAnalysis.includes("Joint actions:")
      || !movementAnalysis.includes("Implement path:")
      || !movementAnalysis.includes("Movement pattern:")
      || !movementAnalysis.includes("Full-set progression:")
    ) {
      throw new Error(`Movement-first analysis is invalid: ${JSON.stringify(movementAnalysis)}`);
    }
    const corrections = Array.isArray(storedResult.priority_corrections) ? storedResult.priority_corrections as Record<string, unknown>[] : [];
    const strengths = Array.isArray(storedResult.did_well) ? storedResult.did_well as Record<string, unknown>[] : [];
    const advice = Array.isArray(storedResult.coaching_cues) ? storedResult.coaching_cues as Record<string, unknown>[] : [];
    const equipmentObservations = Array.isArray(storedResult.equipment_observations)
      ? storedResult.equipment_observations as Record<string, unknown>[]
      : [];
    const exerciseGuide = storedResult.exercise_guide as Record<string, unknown> | null;
    const coachingCoverage = Array.isArray(storedResult.coaching_coverage)
      ? storedResult.coaching_coverage as Record<string, unknown>[]
      : [];
    if (exerciseGuide !== null || coachingCoverage.length > 0) {
      throw new Error(`Fresh analysis retained removed post-analysis cards: ${JSON.stringify({ exerciseGuide, coachingCoverage })}`);
    }
    const malformedBodyweightLoad = equipmentObservations.find((item) => {
      const text = `${String(item.title ?? "")} ${String(item.observation ?? "")}`.toLowerCase();
      return (
        item.category !== "visible_load"
        || /\bbody[\s-]?weight\b/.test(text)
        || /\bno external (?:load|weight|implement|equipment)\b/.test(text)
      ) && item.load !== null;
    });
    if (malformedBodyweightLoad) {
      throw new Error(`Bodyweight or non-load observation retained load metadata: ${JSON.stringify(malformedBodyweightLoad)}`);
    }
    const movementScores = Array.isArray(storedResult.movement_scores) ? storedResult.movement_scores as Record<string, unknown>[] : [];
    const movementScoreLabels = movementScores.map((item) => String(item.label ?? "").trim().toLowerCase());
    if (
      movementScores.length < 3
      || movementScores.length > 5
      || movementScores.some((item) => !item.id || !item.label || !item.observed || !Number.isFinite(Number(item.score)))
      || new Set(movementScoreLabels).size !== movementScoreLabels.length
    ) {
      throw new Error(`Live v28 analysis did not generate three to five distinct exercise-specific scores: ${JSON.stringify(movementScores)}`);
    }
    if (declaration) {
      if (storedSession.detected_label !== declaration.exercise.label) {
        throw new Error(`Declared exercise was renamed: ${JSON.stringify(storedSession.detected_label)}`);
      }
      if (declaration.amount.kind === "reps") {
        const storedSummary = (draft?.setSummary ?? null) as Record<string, unknown> | null;
        if (storedSummary?.totalReps !== declaration.amount.value) {
          throw new Error(`Declared amount was replaced: ${JSON.stringify(storedSummary)}`);
        }
      }
    }
    for (const correction of corrections) {
      const evidence = Array.isArray(correction.evidence) ? correction.evidence as Record<string, unknown>[] : [];
      const primaryEvidenceIndex = correction.primaryEvidenceIndex;
      if (!Number.isInteger(primaryEvidenceIndex) || Number(primaryEvidenceIndex) < 0 || Number(primaryEvidenceIndex) >= evidence.length) {
        throw new Error(`Correction has no valid primary evidence: ${JSON.stringify(correction)}`);
      }
      if (evidence.some((moment) => !Number.isInteger(moment.peakMs) || Number(moment.startMs) >= Number(moment.peakMs) || Number(moment.peakMs) >= Number(moment.endMs))) {
        throw new Error(`Correction has invalid exact evidence timing: ${JSON.stringify(correction)}`);
      }
      if (!Array.isArray(correction.observedIssueRegions)) {
        throw new Error(`Correction has no observed anatomy regions: ${JSON.stringify(correction)}`);
      }
      const cueText = `${String(correction.correction ?? "")} ${String(correction.cue ?? "")}`.toLowerCase();
      const diagnosisText = `${String(correction.title ?? "")} ${String(correction.detail ?? "")}`.toLowerCase();
      const directsImplementTowardHip = /\b(?:toward|towards|to)\s+(?:the|your)\s+(?:hip|waist)\b/.test(cueText);
      if (directsImplementTowardHip && !/\b(path|endpoint|travel|toward|hip)\b/.test(diagnosisText)) {
        throw new Error(`Hip-directed cue is not diagnosed as a path or endpoint issue: ${JSON.stringify(correction)}`);
      }
    }
    const coachingTopics = [...corrections, ...strengths, ...advice];
    const actionTopics = [...corrections, ...advice];
    if (corrections.length < 4) throw new Error(`Single-pass analysis returned fewer than four distinct evidence-backed whole-lift corrections: ${corrections.length}`);
    if (actionTopics.length < 2) throw new Error(`Single-pass analysis returned fewer than two action-oriented correction or advice topics: ${actionTopics.length}`);
    const visibleFindingText = (finding: Record<string, unknown>) => [
      finding.title,
      finding.detail,
      finding.whyItMatters,
      finding.correction,
      finding.cue,
      ...Object.values((finding.expandedCoaching ?? {}) as Record<string, unknown>),
    ].filter((value) => typeof value === "string");
    const userFacingResult = [
      storedResult.overall_assessment,
      storedResult.coach_note,
      ...(storedResult.movement_scores as Record<string, unknown>[]).flatMap((score) => [score.label, score.observed]),
      ...strengths.flatMap(visibleFindingText),
      ...corrections.flatMap(visibleFindingText),
      ...advice.flatMap(visibleFindingText),
      ...(storedResult.next_set_plan as Record<string, unknown>[]).flatMap((plan) => [plan.action, plan.rationale, plan.successCheck]),
    ].filter((value) => typeof value === "string").join(" ");
    const unsupported = /\bactivat(?:e|es|ed|ing|ion)|\bbrac(?:e|es|ed|ing)|\bengag(?:e|es|ed|ing)|\bisolat(?:e|es|ed|ing|ion)|\brelax(?:es|ed|ing|ation)?|\btension\b|\bcontraction\b|\blengthened\b|\bmusculature\b|muscle focus|internal force|load distribution|more load|less load|\bforce\b|\bprotect(?:s|ed|ing)?\b|\boptimiz(?:e|es|ed|ing)\b|\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|forty-five|fifty|sixty|seventy|eighty|ninety|hundred|\d+(?:\.\d+)?)\s*-?\s*degrees?\b/i.test(userFacingResult);
    if (unsupported) throw new Error(`Result contains unsupported mechanism or angle claims: ${userFacingResult}`);
    const mislabeledAdvice = advice.filter((finding) =>
      !String(finding.detail ?? "").startsWith("This is general advice for your next set, not a mistake observed in this recording.")
    );
    if (mislabeledAdvice.length > 0) {
      throw new Error(`Advice was presented as an observed fault: ${JSON.stringify(mislabeledAdvice)}`);
    }
    const findingsWithUnsupportedRecurrence = [
      ...(Array.isArray(storedResult.did_well) ? storedResult.did_well as Record<string, unknown>[] : []),
      ...corrections,
    ].filter((finding) => {
      const evidence = Array.isArray(finding.evidence) ? finding.evidence : [];
      return evidence.length < 2
        && /\bthroughout\b|\bacross all\b|\bacross (?:the )?set\b|\ball \d+ (?:repetitions|reps)\b|\bevery (?:repetition|rep)\b|\bconsisten(?:t|tly)\b|\brepeatable\b/i.test(String(finding.detail ?? ""));
    });
    if (findingsWithUnsupportedRecurrence.length > 0) {
      throw new Error(`Findings claim recurrence without separated evidence: ${JSON.stringify(findingsWithUnsupportedRecurrence)}`);
    }
    const expectedVisibleTerms = (process.env.LIVE_EXPECT_VISIBLE_TERMS ?? "")
      .split(",")
      .map((term) => term.trim().toLowerCase())
      .filter(Boolean);
    const inspectionRecord = JSON.stringify({
      movementAnalysis,
      equipmentObservations: storedResult.equipment_observations,
      strengths,
      corrections,
      advice,
    }).toLowerCase();
    const missingVisibleTerms = expectedVisibleTerms.filter((term) => !inspectionRecord.includes(term));
    if (missingVisibleTerms.length > 0) {
      throw new Error(`Analysis missed required visible machine observations: ${missingVisibleTerms.join(", ")}`);
    }
    const expectedPathEndpoint = (
      process.argv.find((argument) => argument.startsWith("--expect-path-endpoint="))?.split("=")[1]
      ?? process.env.LIVE_EXPECT_PATH_ENDPOINT
    )?.trim().toLowerCase();
    if (expectedPathEndpoint) {
      const matchingPathCorrection = corrections.find((finding) => {
        const diagnosis = `${String(finding.title ?? "")} ${String(finding.detail ?? "")}`.toLowerCase();
        const advice = `${String(finding.correction ?? "")} ${String(finding.cue ?? "")}`.toLowerCase();
        return /\b(path|endpoint|travel|trajectory|finish)\b/.test(diagnosis)
          && advice.includes(expectedPathEndpoint);
      });
      if (!matchingPathCorrection) {
        throw new Error(`Expected a named path or endpoint diagnosis with a cue toward ${expectedPathEndpoint}: ${JSON.stringify(corrections)}`);
      }
    }
    const analystTelemetry = (telemetry ?? []).filter((call) => call.stage === "analyzing");
    const successfulAnalystTelemetry = analystTelemetry.filter((call) => call.status === "succeeded");
    const expectedPrivacyFallbackFailures = analystTelemetry.filter((call) =>
      call.status === "failed" && call.error_code === "GEMINI_PROHIBITED_CONTENT"
    );
    if (
      successfulAnalystTelemetry.length !== 1
      || successfulAnalystTelemetry[0].requested_fps !== 12
      || successfulAnalystTelemetry[0].clip_start_ms !== null
      || successfulAnalystTelemetry[0].clip_end_ms !== null
      || analystTelemetry.length !== successfulAnalystTelemetry.length + expectedPrivacyFallbackFailures.length
      || expectedPrivacyFallbackFailures.length > 1
    ) throw new Error(`Single successful analyst telemetry is invalid: ${JSON.stringify(analystTelemetry)}`);
    const repairTelemetry = (telemetry ?? []).filter((call) => call.stage === "repairing_analysis");
    if (repairTelemetry.length > 1 || repairTelemetry.some((call) => call.model !== "gemini-3.6-flash" || call.requested_fps !== 12 || call.clip_start_ms !== null || call.clip_end_ms !== null || call.status !== "succeeded")) throw new Error(`Factual-analysis repair telemetry is invalid: ${JSON.stringify(repairTelemetry)}`);
    const writerTelemetry = (telemetry ?? []).filter((call) => call.stage === "checking_consistency");
    if (writerTelemetry.length < 1 || writerTelemetry.length > 3 || writerTelemetry.some((call) => call.model !== "gemini-3.1-flash-lite" || call.requested_fps !== null || call.status !== "succeeded")) throw new Error(`Writer consistency telemetry is invalid: ${JSON.stringify(writerTelemetry)}`);
    const targetedReviewTelemetry = (telemetry ?? []).filter((call) => call.stage === "double_checking");
    if (targetedReviewTelemetry.some((call) => call.model !== "gemini-3.6-flash" || call.requested_fps !== 12 || call.clip_start_ms === null || call.clip_end_ms === null || Number(call.clip_end_ms) - Number(call.clip_start_ms) >= durationMs || call.status !== "succeeded")) throw new Error(`Targeted contradiction review was not clip-bounded: ${JSON.stringify(targetedReviewTelemetry)}`);
    if (!storedSession.writer_result_v2 || typeof storedSession.writer_result_v2 !== "object") throw new Error("Coaching writer result was not persisted");
    if ((telemetry ?? []).some((call) => call.stage === "auditing_corrections")) throw new Error(`An external correction audit ran unexpectedly: ${JSON.stringify(telemetry)}`);

    let reanalysis: Record<string, unknown> | null = null;
    if (process.env.LIVE_VERIFY_REANALYSIS !== "0") {
      const resetResponse = await fetchWithTimeout(`${supabaseUrl}/functions/v1/reanalyze-video`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, apikey: anonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const resetBody = await resetResponse.json() as Record<string, unknown>;
      if (resetResponse.status !== 202) throw new Error(`Live reanalysis reset failed (${resetResponse.status}): ${JSON.stringify(resetBody)}`);
      const reanalysisRun = await runAnalysis("reanalysis");
      const [{ data: reanalyzedSession, error: reanalyzedSessionError }, { data: reanalyzedResult, error: reanalyzedResultError }, { data: reanalyzedTelemetry, error: reanalyzedTelemetryError }] = await Promise.all([
        admin.from("analysis_sessions").select("pipeline_version,writer_result_v2,detected_label").eq("id", sessionId).single(),
        admin.from("analysis_results").select("did_well,priority_corrections,coaching_cues").eq("session_id", sessionId).single(),
        admin.from("model_call_telemetry").select("stage,model,requested_fps,clip_start_ms,clip_end_ms,status,error_code").eq("session_id", sessionId).order("created_at"),
      ]);
      if (reanalyzedSessionError || reanalyzedResultError || reanalyzedTelemetryError) throw reanalyzedSessionError ?? reanalyzedResultError ?? reanalyzedTelemetryError;
      const reanalyzedCorrections = Array.isArray(reanalyzedResult.priority_corrections) ? reanalyzedResult.priority_corrections : [];
      const reanalyzedTopics = [
        ...(Array.isArray(reanalyzedResult.did_well) ? reanalyzedResult.did_well : []),
        ...(Array.isArray(reanalyzedResult.priority_corrections) ? reanalyzedResult.priority_corrections : []),
        ...(Array.isArray(reanalyzedResult.coaching_cues) ? reanalyzedResult.coaching_cues : []),
      ];
      const reanalyzedActions = [
        ...(Array.isArray(reanalyzedResult.priority_corrections) ? reanalyzedResult.priority_corrections : []),
        ...(Array.isArray(reanalyzedResult.coaching_cues) ? reanalyzedResult.coaching_cues : []),
      ];
      if (reanalyzedSession.pipeline_version !== "gemini-analyst-coach-v33" || !reanalyzedSession.writer_result_v2 || reanalyzedCorrections.length < 4) {
        throw new Error(`Reanalysis did not use the same v33 whole-lift correction contract: ${JSON.stringify({ reanalyzedSession, correctionCount: reanalyzedCorrections.length, topicCount: reanalyzedTopics.length, actionCount: reanalyzedActions.length })}`);
      }
      reanalysis = {
        status: "passed",
        stages: reanalysisRun.stages,
        pipelineVersion: reanalyzedSession.pipeline_version,
        correctionCount: reanalyzedCorrections.length,
        topicCount: reanalyzedTopics.length,
        telemetry: reanalyzedTelemetry,
      };
    }

    process.stdout.write(`${JSON.stringify({
      status: "passed",
      source: sourceLabel,
      disposableSessionId: sessionId,
      stages,
      pipelineVersion: storedSession.pipeline_version,
      recognition: {
        label: storedSession.detected_label,
        variation: storedSession.detected_variation,
        exerciseFamily: storedSession.exercise_family,
      },
      score: storedResult.score,
      totalCorrections: corrections.length,
      totalTopics: coachingTopics.length,
      wholeSetCoverage,
      overallAssessment: storedResult.overall_assessment,
      coachNote: storedResult.coach_note,
      movementScores,
      muscleFocus: storedResult.muscle_focus,
      equipmentObservations: storedResult.equipment_observations,
      exerciseGuide: storedResult.exercise_guide,
      coachingCoverage: storedResult.coaching_coverage,
      strengths: storedResult.did_well,
      advice: storedResult.coaching_cues,
      nextSetPlan: storedResult.next_set_plan,
      repTimeline: storedResult.rep_timeline,
      corrections: corrections.map((finding) => ({
        id: finding.id,
        title: finding.title,
        detail: finding.detail,
        whyItMatters: finding.whyItMatters,
        correction: finding.correction,
        cue: finding.cue,
        actionableCorrection: finding.actionableCorrection,
        expandedCoaching: finding.expandedCoaching,
        observedIssueRegions: finding.observedIssueRegions,
        evidence: finding.evidence,
      })),
      telemetry,
      reanalysis,
    }, null, 2)}\n`);
  } finally {
    const stored = await admin.from("analysis_sessions").select("gemini_file_name").eq("id", sessionId).maybeSingle();
    if (stored.data?.gemini_file_name) await geminiFiles.deleteFile(stored.data.gemini_file_name).catch(() => undefined);
    if (storagePath) await admin.storage.from("analysis-videos").remove([storagePath]).catch(() => undefined);
    if (analysisStoragePath) await admin.storage.from("analysis-videos").remove([analysisStoragePath]).catch(() => undefined);
    if (fallbackStoragePath) await admin.storage.from("analysis-videos").remove([fallbackStoragePath]).catch(() => undefined);
    if (userId) await admin.auth.admin.deleteUser(userId).catch(() => undefined);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
