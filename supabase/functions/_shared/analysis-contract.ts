export type CameraView = "front" | "side" | "diagonal" | "elevated" | "low" | "uncertain";

export type EvidenceMoment = {
  startMs: number;
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
    cameraView: CameraView;
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
  viewNote: string | null;
  comparison: { previousSessionId: string; summary: string; priorityIssueImproved: boolean | null } | null;
};

const evidenceSchema = {
  type: "object",
  required: ["startMs", "endMs", "repNumber", "phase", "visualEvidence", "visibleBodyAreas", "confidence"],
  properties: {
    startMs: { type: "integer", minimum: 0 },
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

export const GEMINI_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  required: ["status", "recognition", "videoCheck", "overallAssessment", "score", "scoreRationale", "didWell", "priorityCorrections", "coachingCues", "viewNote", "comparison"],
  properties: {
    status: { type: "string", enum: ["complete", "partial", "unable"] },
    recognition: {
      type: "object",
      required: ["label", "variation", "equipment", "confidence", "alternatives", "catalogExerciseId", "cameraView"],
      properties: {
        label: { type: ["string", "null"] },
        variation: { type: ["string", "null"] },
        equipment: { type: "array", items: { type: "string" } },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        alternatives: { type: "array", items: { type: "string" } },
        catalogExerciseId: { type: ["integer", "null"] },
        cameraView: { type: "string", enum: ["front", "side", "diagonal", "elevated", "low", "uncertain"] },
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
    viewNote: { type: ["string", "null"] },
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
      if (!Number.isInteger(moment.startMs) || !Number.isInteger(moment.endMs) || Number(moment.startMs) < 0 || Number(moment.endMs) <= Number(moment.startMs) || Number(moment.endMs) > durationMs) {
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
  if (!["front", "side", "diagonal", "elevated", "low", "uncertain"].includes(String(recognition.cameraView))) throw new Error("cameraView is invalid");

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
  string(result.viewNote, "viewNote", true);

  if (result.comparison !== null) {
    const comparison = object(result.comparison, "comparison");
    string(comparison.previousSessionId, "previousSessionId");
    string(comparison.summary, "comparison.summary");
    if (comparison.priorityIssueImproved !== null && typeof comparison.priorityIssueImproved !== "boolean") throw new Error("priorityIssueImproved is invalid");
  }

  if (score !== null && (recognitionConfidence < 0.8 || result.scoreRationale.length < 2)) throw new Error("score requires confident recognition and two supported criteria");
  if (score === null && result.scoreRationale.length > 0) throw new Error("score rationale requires a score");

  if (result.status === "unable") {
    if (videoCheck.outcome !== "unable" || didWell.length || corrections.length || cues.length) throw new Error("unable result cannot contain coaching");
    if (result.overallAssessment !== null || score !== null || !videoCheck.retryReason || !videoCheck.retryInstruction) throw new Error("unable result requires retry guidance and no assessment");
  } else if (videoCheck.outcome === "unable" || !result.overallAssessment) {
    throw new Error("analyzed result requires visible assessment evidence");
  }

  return value as AnalysisCandidate;
}
