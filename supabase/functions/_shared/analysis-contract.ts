export type ExerciseFamily = "curl" | "triceps" | "press" | "overhead-press" | "fly" | "raise" | "row" | "pull-down" | "squat" | "lunge" | "hinge" | "hip-thrust" | "carry" | "core" | "plank" | "other";

export type EvidenceMoment = {
  startMs: number;
  peakMs: number;
  endMs: number;
  repNumber: number | null;
  phase: string | null;
  visualEvidence: string;
  visibleBodyAreas: string[];
  confidence: number;
};

export type CoachingFinding = {
  id: string;
  title: string;
  detail: string;
  whyItMatters: string;
  correction: string | null;
  cue: string | null;
  severity: "note" | "important" | "high";
  evidence: EvidenceMoment[];
};

export type AnalysisCandidate = {
  status: "complete" | "partial" | "unable";
  recognition: {
    label: string | null;
    variation: string | null;
    equipment: string[];
    confidence: number;
    alternatives: string[];
    catalogExerciseId: number | null;
    exerciseFamily: ExerciseFamily;
  };
  videoCheck: {
    outcome: "usable" | "partial" | "unable";
    usableObservations: string[];
    limitations: string[];
    retryReason: string | null;
    retryInstruction: string | null;
  };
  overallAssessment: string | null;
  score: number | null;
  scoreRationale: Array<{ criterion: string; observed: string; impact: number; confidence: number }>;
  didWell: CoachingFinding[];
  priorityCorrections: CoachingFinding[];
  coachingCues: CoachingFinding[];
  setSummary: { totalReps: number | null; consistentReps: number | null; verdict: string | null };
  repTimeline: Array<{ repNumber: number; startMs: number; peakMs: number; endMs: number; assessment: "strong" | "consistent" | "breakdown" | "uncertain"; note: string }>;
  nextSetPlan: Array<{ id: string; action: string; rationale: string; relatedFindingId: string | null }>;
  precisionRequest: {
    requestedRuns: number;
    reason: string | null;
    targets: Array<{ kind: "recognition" | "timestamp" | "technique"; findingId: string | null; startMs: number | null; endMs: number | null; question: string }>;
  };
  precisionReview?: {
    runsRequested: number;
    runsUsed: number;
    status: "not-needed" | "completed" | "partial" | "failed";
    summary: string | null;
    passes: Array<{
      passNumber: number;
      kind: "recognition" | "timestamp" | "technique";
      outcome: "confirmed" | "revised" | "rejected" | "inconclusive" | "failed";
      reason: string;
      checkedFindingId: string | null;
      startMs: number | null;
      endMs: number | null;
      usage: { promptTokens: number; outputTokens: number; thinkingTokens: number };
    }>;
  };
  verification?: {
    performed: boolean;
    reason: string | null;
    outcome: "not-needed" | "confirmed" | "revised" | "rejected" | "failed";
    checkedFindingId: string | null;
    usage?: { promptTokens: number; outputTokens: number; thinkingTokens: number };
  };
  comparison: { previousSessionId: string; summary: string; priorityIssueImproved: boolean | null } | null;
};

const evidenceSchema = {
  type: "object",
  required: ["startMs", "peakMs", "endMs", "repNumber", "phase", "visualEvidence", "visibleBodyAreas", "confidence"],
  properties: {
    startMs: { type: "integer", minimum: 0 },
    peakMs: { type: "integer", minimum: 0 },
    endMs: { type: "integer", minimum: 1 },
    repNumber: { type: ["integer", "null"] },
    phase: { type: ["string", "null"] },
    visualEvidence: { type: "string" },
    visibleBodyAreas: { type: "array", items: { type: "string" }, minItems: 1 },
    confidence: { type: "number", minimum: 0.75, maximum: 1 },
  },
} as const;

const findingSchema = {
  type: "object",
  required: ["id", "title", "detail", "whyItMatters", "correction", "cue", "severity", "evidence"],
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    detail: { type: "string" },
    whyItMatters: { type: "string" },
    correction: { type: ["string", "null"] },
    cue: { type: ["string", "null"] },
    severity: { type: "string", enum: ["note", "important", "high"] },
    evidence: { type: "array", minItems: 1, items: evidenceSchema },
  },
} as const;

const repTimelineSchema = {
  type: "object",
  required: ["repNumber", "startMs", "peakMs", "endMs", "assessment", "note"],
  properties: {
    repNumber: { type: "integer", minimum: 1 },
    startMs: { type: "integer", minimum: 0 },
    peakMs: { type: "integer", minimum: 0 },
    endMs: { type: "integer", minimum: 1 },
    assessment: { type: "string", enum: ["strong", "consistent", "breakdown", "uncertain"] },
    note: { type: "string" },
  },
} as const;

const nextSetPlanSchema = {
  type: "object",
  required: ["id", "action", "rationale", "relatedFindingId"],
  properties: {
    id: { type: "string" },
    action: { type: "string" },
    rationale: { type: "string" },
    relatedFindingId: { type: ["string", "null"] },
  },
} as const;

const precisionTargetSchema = {
  type: "object",
  required: ["kind", "findingId", "startMs", "endMs", "question"],
  properties: {
    kind: { type: "string", enum: ["recognition", "timestamp", "technique"] },
    findingId: { type: ["string", "null"] },
    startMs: { type: ["integer", "null"], minimum: 0 },
    endMs: { type: ["integer", "null"], minimum: 1 },
    question: { type: "string" },
  },
} as const;

export const GEMINI_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  required: ["status", "recognition", "videoCheck", "overallAssessment", "score", "scoreRationale", "didWell", "priorityCorrections", "coachingCues", "setSummary", "repTimeline", "nextSetPlan", "precisionRequest", "comparison"],
  properties: {
    status: { type: "string", enum: ["complete", "partial", "unable"] },
    recognition: {
      type: "object",
      required: ["label", "variation", "equipment", "confidence", "alternatives", "catalogExerciseId", "exerciseFamily"],
      properties: {
        label: { type: ["string", "null"] },
        variation: { type: ["string", "null"] },
        equipment: { type: "array", items: { type: "string" } },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        alternatives: { type: "array", items: { type: "string" } },
        catalogExerciseId: { type: ["integer", "null"] },
        exerciseFamily: { type: "string", enum: ["curl", "triceps", "press", "overhead-press", "fly", "raise", "row", "pull-down", "squat", "lunge", "hinge", "hip-thrust", "carry", "core", "plank", "other"] },
      },
    },
    videoCheck: {
      type: "object",
      required: ["outcome", "usableObservations", "limitations", "retryReason", "retryInstruction"],
      properties: {
        outcome: { type: "string", enum: ["usable", "partial", "unable"] },
        usableObservations: { type: "array", items: { type: "string" } },
        limitations: { type: "array", items: { type: "string" } },
        retryReason: { type: ["string", "null"] },
        retryInstruction: { type: ["string", "null"] },
      },
    },
    overallAssessment: { type: ["string", "null"] },
    score: { type: ["number", "null"], minimum: 0, maximum: 100 },
    scoreRationale: {
      type: "array",
      items: {
        type: "object",
        required: ["criterion", "observed", "impact", "confidence"],
        properties: {
          criterion: { type: "string" },
          observed: { type: "string" },
          impact: { type: "number", minimum: 0, maximum: 100 },
          confidence: { type: "number", minimum: 0.75, maximum: 1 },
        },
      },
    },
    didWell: { type: "array", items: findingSchema },
    priorityCorrections: { type: "array", items: findingSchema },
    coachingCues: { type: "array", items: findingSchema },
    setSummary: {
      type: "object",
      required: ["totalReps", "consistentReps", "verdict"],
      properties: {
        totalReps: { type: ["integer", "null"], minimum: 1 },
        consistentReps: { type: ["integer", "null"], minimum: 0 },
        verdict: { type: ["string", "null"] },
      },
    },
    repTimeline: { type: "array", items: repTimelineSchema },
    nextSetPlan: { type: "array", maxItems: 5, items: nextSetPlanSchema },
    precisionRequest: {
      type: "object",
      required: ["requestedRuns", "reason", "targets"],
      properties: {
        requestedRuns: { type: "integer", minimum: 0, maximum: 3 },
        reason: { type: ["string", "null"] },
        targets: { type: "array", maxItems: 3, items: precisionTargetSchema },
      },
    },
    comparison: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          required: ["previousSessionId", "summary", "priorityIssueImproved"],
          properties: {
            previousSessionId: { type: "string" },
            summary: { type: "string" },
            priorityIssueImproved: { type: ["boolean", "null"] },
          },
        },
      ],
    },
  },
} as const;

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string, nullable = false): string | null {
  if (nullable && value === null) return null;
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value;
}

function number(value: unknown, label: string, minimum: number, maximum: number, nullable = false): number | null {
  if (nullable && value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}`);
  }
  return value;
}

function strings(value: unknown, label: string, requireOne = false): string[] {
  if (!Array.isArray(value) || (requireOne && value.length === 0)) throw new Error(`${label} requires at least one visible body area`);
  value.forEach((item) => string(item, label));
  return value as string[];
}

function findings(value: unknown, label: string, durationMs: number): CoachingFinding[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  for (const rawFinding of value) {
    const finding = object(rawFinding, `${label} finding`);
    string(finding.id, `${label}.id`);
    string(finding.title, `${label}.title`);
    string(finding.detail, `${label}.detail`);
    string(finding.whyItMatters, `${label}.whyItMatters`);
    string(finding.correction, `${label}.correction`, true);
    string(finding.cue, `${label}.cue`, true);
    if (!["note", "important", "high"].includes(String(finding.severity))) throw new Error(`${label}.severity is invalid`);
    if (!Array.isArray(finding.evidence) || finding.evidence.length === 0) throw new Error(`${label} requires evidence`);
    for (const rawMoment of finding.evidence) {
      const moment = object(rawMoment, `${label}.evidence`);
      if (!Number.isInteger(moment.startMs) || !Number.isInteger(moment.peakMs) || !Number.isInteger(moment.endMs) || Number(moment.startMs) < 0 || Number(moment.peakMs) < Number(moment.startMs) || Number(moment.peakMs) > Number(moment.endMs) || Number(moment.endMs) <= Number(moment.startMs) || Number(moment.endMs) > durationMs) {
        throw new Error("Evidence timestamp is outside the recorded video");
      }
      if (moment.repNumber !== null && (!Number.isInteger(moment.repNumber) || Number(moment.repNumber) < 1)) throw new Error("repNumber is invalid");
      string(moment.phase, "phase", true);
      string(moment.visualEvidence, "visualEvidence");
      strings(moment.visibleBodyAreas, "visibleBodyAreas", true);
      number(moment.confidence, "evidence confidence", 0.75, 1);
    }
  }
  return value as CoachingFinding[];
}

export function validateAnalysisCandidate(value: unknown, durationMs: number): AnalysisCandidate {
  const result = object(value, "analysis result");
  if (!["complete", "partial", "unable"].includes(String(result.status))) throw new Error("status is invalid");

  const recognition = object(result.recognition, "recognition");
  string(recognition.label, "recognition.label", true);
  string(recognition.variation, "recognition.variation", true);
  strings(recognition.equipment, "recognition.equipment");
  const recognitionConfidence = number(recognition.confidence, "recognition confidence", 0, 1) as number;
  strings(recognition.alternatives, "recognition.alternatives");
  if (recognition.catalogExerciseId !== null && (!Number.isInteger(recognition.catalogExerciseId) || Number(recognition.catalogExerciseId) < 1)) throw new Error("catalogExerciseId is invalid");
  if (!["curl", "triceps", "press", "overhead-press", "fly", "raise", "row", "pull-down", "squat", "lunge", "hinge", "hip-thrust", "carry", "core", "plank", "other"].includes(String(recognition.exerciseFamily))) throw new Error("exerciseFamily is invalid");

  const videoCheck = object(result.videoCheck, "videoCheck");
  if (!["usable", "partial", "unable"].includes(String(videoCheck.outcome))) throw new Error("videoCheck outcome is invalid");
  strings(videoCheck.usableObservations, "usableObservations");
  strings(videoCheck.limitations, "limitations");
  string(videoCheck.retryReason, "retryReason", true);
  string(videoCheck.retryInstruction, "retryInstruction", true);

  string(result.overallAssessment, "overallAssessment", true);
  const score = number(result.score, "score", 0, 100, true);
  if (!Array.isArray(result.scoreRationale)) throw new Error("scoreRationale must be an array");
  for (const rawReason of result.scoreRationale) {
    const reason = object(rawReason, "score rationale");
    string(reason.criterion, "criterion");
    string(reason.observed, "observed");
    number(reason.impact, "impact", 0, 100);
    number(reason.confidence, "score confidence", 0.75, 1);
  }

  const didWell = findings(result.didWell, "didWell", durationMs);
  const corrections = findings(result.priorityCorrections, "priorityCorrections", durationMs);
  const cues = findings(result.coachingCues, "coachingCues", durationMs);

  const setSummary = object(result.setSummary, "setSummary");
  const totalReps = number(setSummary.totalReps, "setSummary.totalReps", 1, 10_000, true);
  const consistentReps = number(setSummary.consistentReps, "setSummary.consistentReps", 0, 10_000, true);
  string(setSummary.verdict, "setSummary.verdict", true);
  if (totalReps !== null && consistentReps !== null && consistentReps > totalReps) throw new Error("consistent repetitions cannot exceed total repetitions");

  if (!Array.isArray(result.repTimeline)) throw new Error("repTimeline must be an array");
  let previousRepNumber = 0;
  let previousRepEnd = -1;
  for (const rawRep of result.repTimeline) {
    const rep = object(rawRep, "repTimeline item");
    if (!Number.isInteger(rep.repNumber) || Number(rep.repNumber) < 1) throw new Error("repTimeline repNumber is invalid");
    if (!Number.isInteger(rep.startMs) || !Number.isInteger(rep.peakMs) || !Number.isInteger(rep.endMs) || Number(rep.startMs) < 0 || Number(rep.startMs) >= Number(rep.endMs) || Number(rep.startMs) > Number(rep.peakMs) || Number(rep.peakMs) > Number(rep.endMs) || Number(rep.endMs) > durationMs) throw new Error("repTimeline timestamp is outside the recorded video");
    if (Number(rep.repNumber) <= previousRepNumber || Number(rep.startMs) < previousRepEnd) throw new Error("repTimeline must be ordered with unique non-overlapping repetitions");
    previousRepNumber = Number(rep.repNumber);
    previousRepEnd = Number(rep.endMs);
    if (!["strong", "consistent", "breakdown", "uncertain"].includes(String(rep.assessment))) throw new Error("repTimeline assessment is invalid");
    string(rep.note, "repTimeline.note");
  }

  if (!Array.isArray(result.nextSetPlan) || result.nextSetPlan.length > 5) throw new Error("nextSetPlan must contain at most five actions");
  const findingIds = new Set([...didWell, ...corrections, ...cues].map((finding) => finding.id));
  for (const rawItem of result.nextSetPlan) {
    const item = object(rawItem, "nextSetPlan item");
    string(item.id, "nextSetPlan.id");
    string(item.action, "nextSetPlan.action");
    string(item.rationale, "nextSetPlan.rationale");
    string(item.relatedFindingId, "nextSetPlan.relatedFindingId", true);
    if (item.relatedFindingId !== null && !findingIds.has(String(item.relatedFindingId))) throw new Error("nextSetPlan references an unknown finding");
  }

  const repByNumber = new Map((result.repTimeline as AnalysisCandidate["repTimeline"]).map((rep) => [rep.repNumber, rep]));
  for (const finding of [...didWell, ...corrections, ...cues]) {
    for (const moment of finding.evidence) {
      if (moment.repNumber === null) continue;
      const rep = repByNumber.get(moment.repNumber);
      if (!rep || moment.peakMs < rep.startMs || moment.peakMs > rep.endMs) throw new Error("Finding evidence does not fall inside its referenced repetition");
    }
  }

  const precisionRequest = object(result.precisionRequest, "precisionRequest");
  if (!Number.isInteger(precisionRequest.requestedRuns) || Number(precisionRequest.requestedRuns) < 0 || Number(precisionRequest.requestedRuns) > 3) throw new Error("precisionRequest.requestedRuns must be between 0 and 3");
  string(precisionRequest.reason, "precisionRequest.reason", true);
  if (!Array.isArray(precisionRequest.targets) || precisionRequest.targets.length !== Number(precisionRequest.requestedRuns)) throw new Error("precisionRequest targets must match requested runs");
  for (const rawTarget of precisionRequest.targets) {
    const target = object(rawTarget, "precisionRequest target");
    if (!["recognition", "timestamp", "technique"].includes(String(target.kind))) throw new Error("precisionRequest target kind is invalid");
    string(target.findingId, "precisionRequest.findingId", true);
    string(target.question, "precisionRequest.question");
    const hasWindow = target.startMs !== null || target.endMs !== null;
    if (target.kind !== "recognition" && !hasWindow) throw new Error("precisionRequest timestamp and technique targets require a window");
    if (hasWindow && (!Number.isInteger(target.startMs) || !Number.isInteger(target.endMs) || Number(target.startMs) < 0 || Number(target.endMs) <= Number(target.startMs) || Number(target.endMs) > durationMs)) throw new Error("precisionRequest target window is outside the recorded video");
    if (target.kind !== "recognition" && (target.findingId === null || !findingIds.has(String(target.findingId)))) throw new Error("precisionRequest target references an unknown finding");
  }
  if (Number(precisionRequest.requestedRuns) > 0 && !precisionRequest.reason) throw new Error("precisionRequest requires a reason when premium runs are requested");

  if (result.precisionReview !== undefined) {
    const review = object(result.precisionReview, "precisionReview");
    if (!Number.isInteger(review.runsRequested) || Number(review.runsRequested) < 0 || Number(review.runsRequested) > 3) throw new Error("precisionReview.runsRequested must be between 0 and 3");
    if (!Number.isInteger(review.runsUsed) || Number(review.runsUsed) < 0 || Number(review.runsUsed) > Number(review.runsRequested)) throw new Error("precisionReview.runsUsed must not exceed requested runs");
    if (!Array.isArray(review.passes) || review.passes.length !== Number(review.runsUsed)) throw new Error("premium runs used must match recorded passes");
    if (!["not-needed", "completed", "partial", "failed"].includes(String(review.status))) throw new Error("precisionReview status is invalid");
    string(review.summary, "precisionReview.summary", true);
    let failedPasses = 0;
    for (const rawPass of review.passes) {
      const pass = object(rawPass, "precisionReview pass");
      if (!Number.isInteger(pass.passNumber) || Number(pass.passNumber) < 1) throw new Error("precisionReview pass number is invalid");
      if (!["recognition", "timestamp", "technique"].includes(String(pass.kind))) throw new Error("precisionReview pass kind is invalid");
      if (!["confirmed", "revised", "rejected", "inconclusive", "failed"].includes(String(pass.outcome))) throw new Error("precisionReview pass outcome is invalid");
      if (pass.outcome === "failed") failedPasses += 1;
      string(pass.reason, "precisionReview pass reason");
      string(pass.checkedFindingId, "precisionReview checked finding", true);
      const passUsage = object(pass.usage, "precisionReview usage");
      for (const key of ["promptTokens", "outputTokens", "thinkingTokens"] as const) {
        if (!Number.isInteger(passUsage[key]) || Number(passUsage[key]) < 0) throw new Error("precisionReview token usage is invalid");
      }
    }
    if (review.status === "not-needed" && (Number(review.runsRequested) !== 0 || Number(review.runsUsed) !== 0)) throw new Error("not-needed premium review cannot use runs");
    if (review.status === "completed" && (Number(review.runsUsed) !== Number(review.runsRequested) || failedPasses > 0)) throw new Error("completed premium review requires every requested pass");
    if (review.status === "partial" && (failedPasses === 0 || failedPasses === review.passes.length)) throw new Error("partial premium review requires successful and failed passes");
    if (review.status === "failed" && review.passes.length > 0 && failedPasses === 0) throw new Error("failed premium review requires a failed pass");
  }

  if (result.comparison !== null) {
    const comparison = object(result.comparison, "comparison");
    string(comparison.previousSessionId, "previousSessionId");
    string(comparison.summary, "comparison.summary");
    if (comparison.priorityIssueImproved !== null && typeof comparison.priorityIssueImproved !== "boolean") throw new Error("priorityIssueImproved is invalid");
  }

  if (score !== null && (recognitionConfidence < 0.55 || result.scoreRationale.length < 2)) throw new Error("score requires usable recognition and two supported criteria");
  if (score === null && result.scoreRationale.length > 0) throw new Error("score rationale requires a score");

  if (result.status === "unable") {
    if (videoCheck.outcome !== "unable" || didWell.length || corrections.length || cues.length) throw new Error("unable result cannot contain coaching");
    if (result.overallAssessment !== null || score !== null || !videoCheck.retryReason || !videoCheck.retryInstruction || totalReps !== null || consistentReps !== null || result.repTimeline.length || result.nextSetPlan.length || Number(precisionRequest.requestedRuns) !== 0) throw new Error("unable result requires retry guidance and no assessment");
  } else if (videoCheck.outcome === "unable" || !result.overallAssessment) {
    throw new Error("analyzed result requires visible assessment evidence");
  } else if (!recognition.label) {
    throw new Error("analyzed result requires the nearest exercise label");
  } else if (result.nextSetPlan.length === 0) {
    throw new Error("analyzed result requires at least one next-set action");
  }

  return value as AnalysisCandidate;
}
