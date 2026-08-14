import type {
  AnalysisCandidate,
  AnatomyRegion,
  CoachingFinding,
  EvidenceMoment,
  ExerciseFamily,
  MuscleFocus,
  MovementScore,
} from "./analysis-contract.ts";
import type { SetDeclaration } from "./set-declaration.ts";

export type WholeVideoEvidence = {
  startMs: number;
  peakMs: number;
  endMs: number;
  visualEvidence: string;
  visibleBodyAreas: string[];
  confidence: number;
};

export type WholeVideoAnalysis = {
  videoSummary: string;
  visibility: {
    cameraView: string;
    clearlyVisible: string[];
    partlyVisible: string[];
    notVisible: string[];
  };
  issues: Array<{
    id: string;
    title: string;
    observation: string;
    mechanicalConsequence: string;
    prevalence: "isolated" | "repeated" | "throughout";
    severity: "note" | "important" | "high";
    confidence: number;
    observedIssueRegions: AnatomyRegion[];
    evidence: WholeVideoEvidence[];
  }>;
};

export type WholeVideoWriting = {
  overallAssessment: string;
  coachNote: string;
  movementScores: Array<Omit<MovementScore, "score">>;
  muscleFocus: MuscleFocus;
  coachingItems: Array<{
    id: string;
    title: string;
    whatHappened: string;
    whatHappenedDetail: string;
    whyItMatters: string;
    whyItMattersDetail: string;
    whatToDo: string;
    successCheck: string | null;
  }>;
};

export type BoundaryFreeRecognitionContext = {
  exerciseFamily?: ExerciseFamily;
  equipment?: string[];
};

const ANATOMY_REGIONS = [
  "chest", "shoulders", "upper_back", "lats", "upper_arms", "elbows", "forearms", "wrists",
  "torso", "lower_back", "hips", "glutes", "quads", "hamstrings", "adductors", "knees", "calves", "ankles",
] as const satisfies readonly AnatomyRegion[];

const MUSCLE_REGIONS = [
  "chest", "front_shoulders", "rear_shoulders", "upper_back", "lats", "biceps", "triceps", "forearms",
  "abs", "obliques", "lower_back", "glutes", "quads", "hamstrings", "adductors", "calves",
] as const;

function inferExerciseFamily(label: string): ExerciseFamily {
  const value = label.toLowerCase();
  if (/curl/.test(value)) return "curl";
  if (/tricep|skull crusher|pushdown|extension/.test(value)) return "triceps";
  if (/shoulder press|overhead press|military press|arnold press|push press/.test(value)) return "overhead-press";
  if (/bench press|chest press|push-?up/.test(value)) return "press";
  if (/fly|flye|pec deck/.test(value)) return "fly";
  if (/raise/.test(value)) return "raise";
  if (/row/.test(value)) return "row";
  if (/pull.?down|pull.?up|chin.?up/.test(value)) return "pull-down";
  if (/squat/.test(value)) return "squat";
  if (/lunge|split squat|step.?up/.test(value)) return "lunge";
  if (/deadlift|hinge|good morning/.test(value)) return "hinge";
  if (/hip thrust|glute bridge/.test(value)) return "hip-thrust";
  if (/carry|farmer/.test(value)) return "carry";
  if (/plank/.test(value)) return "plank";
  if (/crunch|sit.?up|abdominal|core/.test(value)) return "core";
  return "other";
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown, name: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as JsonRecord;
}

function text(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} must be non-empty text`);
  return value.trim();
}

function stringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${name} must contain only non-empty text`);
  }
  return value.map((item) => String(item).trim());
}

function boundedNumber(value: unknown, name: string, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  }
  return value;
}

function integer(value: unknown, name: string, minimum: number, maximum: number): number {
  const parsed = boundedNumber(value, name, minimum, maximum);
  if (!Number.isInteger(parsed)) throw new Error(`${name} must be an integer`);
  return parsed;
}

export function parseWholeVideoAnalysis(value: unknown, durationMs: number): WholeVideoAnalysis {
  const result = record(value, "analysis");
  const visibility = record(result.visibility, "analysis.visibility");
  if (!Array.isArray(result.issues)) throw new Error("analysis.issues must be an array");
  const ids = new Set<string>();
  const issues = result.issues.map((rawIssue, issueIndex) => {
    const name = `analysis.issues[${issueIndex}]`;
    const issue = record(rawIssue, name);
    const id = text(issue.id, `${name}.id`);
    if (ids.has(id)) throw new Error("analysis issue IDs must be unique");
    ids.add(id);
    if (!Array.isArray(issue.evidence) || issue.evidence.length === 0) throw new Error(`${name}.evidence must contain at least one evidence moment`);
    const evidence = issue.evidence.map((rawMoment, momentIndex) => {
      const momentName = `${name}.evidence[${momentIndex}]`;
      const moment = record(rawMoment, momentName);
      const startMs = integer(moment.startMs, `${momentName}.startMs`, 0, durationMs);
      const peakMs = integer(moment.peakMs, `${momentName}.peakMs`, 0, durationMs);
      const endMs = integer(moment.endMs, `${momentName}.endMs`, 0, durationMs);
      if (!(startMs < peakMs && peakMs < endMs)) throw new Error(`${momentName} must have startMs < peakMs < endMs`);
      return {
        startMs,
        peakMs,
        endMs,
        visualEvidence: text(moment.visualEvidence, `${momentName}.visualEvidence`),
        visibleBodyAreas: stringArray(moment.visibleBodyAreas, `${momentName}.visibleBodyAreas`),
        confidence: boundedNumber(moment.confidence, `${momentName}.confidence`, 0, 1),
      };
    });
    const prevalence = text(issue.prevalence, `${name}.prevalence`);
    if (!(["isolated", "repeated", "throughout"] as string[]).includes(prevalence)) throw new Error(`${name}.prevalence is invalid`);
    const severity = text(issue.severity, `${name}.severity`);
    if (!(["note", "important", "high"] as string[]).includes(severity)) throw new Error(`${name}.severity is invalid`);
    const observedIssueRegions = stringArray(issue.observedIssueRegions, `${name}.observedIssueRegions`);
    if (observedIssueRegions.some((region) => !(ANATOMY_REGIONS as readonly string[]).includes(region))) throw new Error(`${name}.observedIssueRegions is invalid`);
    return {
      id,
      title: text(issue.title, `${name}.title`),
      observation: text(issue.observation, `${name}.observation`),
      mechanicalConsequence: text(issue.mechanicalConsequence, `${name}.mechanicalConsequence`),
      prevalence: prevalence as WholeVideoAnalysis["issues"][number]["prevalence"],
      severity: severity as WholeVideoAnalysis["issues"][number]["severity"],
      confidence: boundedNumber(issue.confidence, `${name}.confidence`, 0, 1),
      observedIssueRegions: observedIssueRegions as AnatomyRegion[],
      evidence,
    };
  });
  return {
    videoSummary: text(result.videoSummary, "analysis.videoSummary"),
    visibility: {
      cameraView: text(visibility.cameraView, "analysis.visibility.cameraView"),
      clearlyVisible: stringArray(visibility.clearlyVisible, "analysis.visibility.clearlyVisible"),
      partlyVisible: stringArray(visibility.partlyVisible, "analysis.visibility.partlyVisible"),
      notVisible: stringArray(visibility.notVisible, "analysis.visibility.notVisible"),
    },
    issues,
  };
}

function publicEvidence(moment: WholeVideoEvidence): EvidenceMoment {
  return {
    startMs: moment.startMs,
    peakMs: moment.peakMs,
    endMs: moment.endMs,
    repNumber: null,
    phase: null,
    visualEvidence: moment.visualEvidence,
    coachingNote: moment.visualEvidence,
    visibleBodyAreas: moment.visibleBodyAreas,
    confidence: moment.confidence,
    focusRegion: null,
  };
}

function coachingArea(issue: WholeVideoAnalysis["issues"][number]): CoachingFinding["coachingArea"] {
  const text = `${issue.title} ${issue.observation}`.toLowerCase();
  if (/grip|hand|wrist|contact/.test(text)) return "grip_contact";
  if (/equipment|bar|dumbbell|cable|machine|bench/.test(text)) return "equipment";
  if (/support|balance|base|stance|foot|feet/.test(text)) return "support_balance";
  if (/setup|posture|position/.test(text)) return "posture_setup";
  return "form";
}

function publicFinding(
  issue: WholeVideoAnalysis["issues"][number],
  writing: WholeVideoWriting["coachingItems"][number],
): CoachingFinding {
  const whatHappened = writing.whatHappened;
  const whatHappenedDetail = writing.whatHappenedDetail;
  const whyItMatters = writing.whyItMatters;
  const whyItMattersDetail = writing.whyItMattersDetail;
  const whatToDo = writing.whatToDo;
  const successCheck = writing.successCheck?.trim() || null;
  const evidence = issue.evidence.map(publicEvidence);
  return {
    id: issue.id,
    coachingType: "correction",
    coachingArea: coachingArea(issue),
    title: writing.title,
    detail: whatHappenedDetail,
    whyItMatters,
    correction: whatToDo,
    cue: whatToDo,
    actionableCorrection: {
      instruction: whatToDo,
      cue: whatToDo,
      successCheck,
      applyWhen: "On the next set at the cited moment.",
    },
    expandedCoaching: {
      summary: writing.title,
      whatHappened,
      whatHappenedDetail,
      whyItMatters,
      whyItMattersDetail,
      whatToDo,
      successCheck,
    },
    severity: issue.severity,
    evidence,
    primaryEvidenceIndex: evidence.length > 0 ? 0 : undefined,
    observedIssueRegions: issue.observedIssueRegions,
  };
}

function parseMovementScores(value: unknown, analysis: WholeVideoAnalysis): MovementScore[] {
  if (!Array.isArray(value) || value.length !== 4) throw new Error("movementScores must contain exactly four scores");
  const issueIds = new Set(analysis.issues.map((issue) => issue.id));
  const ids = new Set<string>();
  const labels = new Set<string>();
  return value.map((rawScore, index) => {
    const name = `writing.movementScores[${index}]`;
    const score = record(rawScore, name);
    const id = text(score.id, `${name}.id`);
    const label = text(score.label, `${name}.label`);
    const normalizedLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (ids.has(id) || labels.has(normalizedLabel)) throw new Error("movement score IDs and labels must be unique");
    ids.add(id);
    labels.add(normalizedLabel);
    const evidenceIds = stringArray(score.evidenceIds, `${name}.evidenceIds`);
    if (evidenceIds.some((evidenceId) => !issueIds.has(evidenceId))) throw new Error(`${name}.evidenceIds must reference analyst issues`);
    return {
      id,
      label,
      observed: text(score.observed, `${name}.observed`),
      evidenceIds,
    };
  });
}

function parseMuscleFocus(value: unknown): MuscleFocus {
  const focus = record(value, "writing.muscleFocus");
  const parseTargets = (raw: unknown, name: string): MuscleFocus["primary"] => {
    if (!Array.isArray(raw)) throw new Error(`${name} must be an array`);
    return raw.map((entry, index) => {
      const item = record(entry, `${name}[${index}]`);
      const region = text(item.region, `${name}[${index}].region`);
      if (!(MUSCLE_REGIONS as readonly string[]).includes(region)) throw new Error(`${name}[${index}].region is invalid`);
      return { name: text(item.name, `${name}[${index}].name`), region: region as MuscleFocus["primary"][number]["region"] };
    });
  };
  const primary = parseTargets(focus.primary, "writing.muscleFocus.primary");
  const primaryRegions = new Set(primary.map((item) => item.region));
  if (primaryRegions.size !== primary.length) throw new Error("writing.muscleFocus.primary regions must be unique");
  const secondary = parseTargets(focus.secondary, "writing.muscleFocus.secondary");
  const secondaryRegions = new Set(secondary.map((item) => item.region));
  if (secondaryRegions.size !== secondary.length || secondary.some((item) => primaryRegions.has(item.region))) {
    throw new Error("writing.muscleFocus regions must be unique across primary and secondary");
  }
  return { primary, secondary, unclassified: [...new Set(stringArray(focus.unclassified, "writing.muscleFocus.unclassified"))] };
}

function parseCoachingItems(value: unknown, analysis: WholeVideoAnalysis): WholeVideoWriting["coachingItems"] {
  if (!Array.isArray(value) || value.length !== analysis.issues.length) {
    throw new Error("writing.coachingItems must cover every analyst issue");
  }
  const parsed = value.map((rawItem, index) => {
    const name = `writing.coachingItems[${index}]`;
    const item = record(rawItem, name);
    const id = text(item.id, `${name}.id`);
    const successCheck = item.successCheck === null ? null : text(item.successCheck, `${name}.successCheck`);
    return {
      id,
      title: text(item.title, `${name}.title`),
      whatHappened: text(item.whatHappened, `${name}.whatHappened`),
      whatHappenedDetail: text(item.whatHappenedDetail, `${name}.whatHappenedDetail`),
      whyItMatters: text(item.whyItMatters, `${name}.whyItMatters`),
      whyItMattersDetail: text(item.whyItMattersDetail, `${name}.whyItMattersDetail`),
      whatToDo: text(item.whatToDo, `${name}.whatToDo`),
      successCheck,
    };
  });
  const byId = new Map(parsed.map((item) => [item.id, item]));
  if (byId.size !== parsed.length || analysis.issues.some((issue) => !byId.has(issue.id))) {
    throw new Error("writing.coachingItems must use every analyst issue ID exactly once");
  }
  return analysis.issues.map((issue) => {
    const item = byId.get(issue.id)!;
    const issueTitle = headingKey(issue.title);
    const whatHappened = headingKey(item.whatHappened);
    const whyItMatters = headingKey(item.whyItMatters);
    if (whatHappened === issueTitle) throw new Error(`writing.coachingItems[${issue.id}].whatHappened must not repeat the issue title`);
    if (whyItMatters === issueTitle) throw new Error(`writing.coachingItems[${issue.id}].whyItMatters must not repeat the issue title`);
    if (whatHappened === whyItMatters) throw new Error(`writing.coachingItems[${issue.id}] section headings must be distinct`);
    return item;
  });
}

function headingKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function headingFromFact(value: string): string {
  const firstThought = value.trim().split(/[.;!?]/, 1)[0]?.trim() || value.trim();
  return firstThought.replace(/^(?:the|your)\s+/i, "").replace(/^./, (character) => character.toUpperCase());
}

export function parseWholeVideoWriting(value: unknown, analysis: WholeVideoAnalysis): WholeVideoWriting {
  const writing = record(value, "writing");
  return {
    overallAssessment: text(writing.overallAssessment, "writing.overallAssessment"),
    coachNote: text(writing.coachNote, "writing.coachNote"),
    movementScores: parseMovementScores(writing.movementScores, analysis),
    muscleFocus: parseMuscleFocus(writing.muscleFocus),
    coachingItems: parseCoachingItems(writing.coachingItems, analysis),
  };
}

function fallbackMovementScores(analysis: WholeVideoAnalysis): MovementScore[] {
  const evidenceIds = analysis.issues.map((issue) => issue.id);
  return calibrateMovementScores([
    { id: "overall-form", label: "Overall Form", observed: "Based on all visible form issues from the complete set.", evidenceIds },
    { id: "movement-path", label: "Movement Path", observed: "Based on the visible paths and positions cited by the analyst.", evidenceIds },
    { id: "control", label: "Control", observed: "Based on the visible control and stability issues cited by the analyst.", evidenceIds },
    { id: "repeatability", label: "Repeatability", observed: "Based on issue prevalence across the complete set.", evidenceIds },
  ], analysis);
}

function calibrateMovementScores(scores: Array<Omit<MovementScore, "score">>, analysis: WholeVideoAnalysis): MovementScore[] {
  const byId = new Map(analysis.issues.map((issue) => [issue.id, issue]));
  const prevalenceWeight = { isolated: 0.5, repeated: 1, throughout: 1.35 } as const;
  const severityWeight = { note: 1.5, important: 4, high: 8 } as const;
  return scores.map((movementScore) => {
    const penalty = movementScore.evidenceIds.reduce((sum, issueId) => {
      const issue = byId.get(issueId);
      return issue
        ? sum + severityWeight[issue.severity] * prevalenceWeight[issue.prevalence] * issue.confidence
        : sum;
    }, 0);
    return { ...movementScore, score: Math.max(45, Math.min(96, Math.round(96 - penalty))) };
  });
}

export function normalizeWholeVideoWriting(value: unknown, analysis: WholeVideoAnalysis): WholeVideoWriting {
  let movementScores = fallbackMovementScores(analysis);
  let muscleFocus: MuscleFocus = { primary: [], secondary: [], unclassified: [] };
  let overallAssessment = analysis.videoSummary;
  let coachNote = analysis.issues[0] ? `Start with ${analysis.issues[0].title.toLowerCase()} on the next set.` : "Repeat the set with the same controlled setup.";
  let coachingItems: WholeVideoWriting["coachingItems"] | null = null;
  let raw: JsonRecord | null = null;
  try {
    raw = record(value, "writing");
  } catch {}
  if (raw) {
    try { overallAssessment = text(raw.overallAssessment, "writing.overallAssessment"); } catch {}
    try { coachNote = text(raw.coachNote, "writing.coachNote"); } catch {}
    try { movementScores = parseMovementScores(raw.movementScores, analysis); } catch {}
    try { muscleFocus = parseMuscleFocus(raw.muscleFocus); } catch {}
    try { coachingItems = parseCoachingItems(raw.coachingItems, analysis); } catch {}
  }
  return {
    overallAssessment,
    coachNote,
    movementScores,
    muscleFocus,
    coachingItems: coachingItems ?? analysis.issues.map((issue) => {
      const evidence = issue.evidence[0]?.visualEvidence ?? issue.observation;
      return {
        id: issue.id,
        title: headingFromFact(issue.observation),
        whatHappened: headingFromFact(issue.observation),
        whatHappenedDetail: `${issue.observation} ${evidence} This was ${issue.prevalence} in the recorded set.`,
        whyItMatters: headingFromFact(issue.mechanicalConsequence),
        whyItMattersDetail: `${issue.mechanicalConsequence} Addressing it makes that part of the exercise easier to control. It also gives you a clearer position to repeat on the next set.`,
        whatToDo: `Adjust ${issue.title.toLowerCase()} during the next set using the visible evidence as your reference.`,
        successCheck: `The cited position stays controlled through the same part of the exercise.`,
      };
    }),
  };
}

export function boundaryFreeToCandidate(
  rawAnalysis: WholeVideoAnalysis,
  writing: WholeVideoWriting,
  declaration?: SetDeclaration,
  recognitionContext: BoundaryFreeRecognitionContext = {},
): AnalysisCandidate & { analysisBasis: "observed"; viewNotes: string[]; generalGuidance: string[] } {
  const analysis = rawAnalysis;
  const writtenItems = new Map(writing.coachingItems.map((item) => [item.id, item]));
  const selectedPeaks: number[] = [];
  const priorityCorrections = analysis.issues.map((issue) => {
    const finding = publicFinding(issue, writtenItems.get(issue.id)!);
    let selectedIndex = 0;
    let selectedDistance = -1;
    let selectedConfidence = -1;
    finding.evidence.forEach((moment, index) => {
      const peak = moment.peakMs ?? moment.startMs;
      const distance = selectedPeaks.length === 0
        ? 0
        : Math.min(...selectedPeaks.map((selectedPeak) => Math.abs(peak - selectedPeak)));
      const confidence = moment.confidence ?? 0;
      if (distance > selectedDistance || (distance === selectedDistance && confidence > selectedConfidence)) {
        selectedIndex = index;
        selectedDistance = distance;
        selectedConfidence = confidence;
      }
    });
    finding.primaryEvidenceIndex = finding.evidence.length > 0 ? selectedIndex : undefined;
    if (finding.evidence[selectedIndex]) selectedPeaks.push(finding.evidence[selectedIndex].peakMs ?? finding.evidence[selectedIndex].startMs);
    return finding;
  });
  const exerciseLabel = declaration?.exercise.label ?? "Exercise attempt";
  const equipment = recognitionContext.equipment
    ?? (declaration?.load.kind === "bodyweight" ? ["bodyweight"] : []);
  const movementScores = calibrateMovementScores(writing.movementScores, analysis);
  const score = movementScores.length > 0
    ? Math.round(movementScores.reduce((sum, item) => sum + item.score, 0) / movementScores.length)
    : null;
  const muscleFocus = writing.muscleFocus;
  const visibleReferences = [...new Set([
    ...analysis.visibility.clearlyVisible,
    ...analysis.visibility.partlyVisible,
  ])].slice(0, 8);
  const declaredRepetitions = declaration?.amount.kind === "reps" ? declaration.amount.value : null;

  return {
    status: "complete",
    analysisBasis: "observed",
    viewNotes: [
      ...analysis.visibility.partlyVisible.map((item) => `${item} is partly visible.`),
      ...analysis.visibility.notVisible.map((item) => `${item} is not visible.`),
    ],
    generalGuidance: [],
    recognition: {
      label: exerciseLabel,
      variation: null,
      equipment,
      confidence: declaration ? 1 : 0.8,
      alternatives: [],
      catalogExerciseId: declaration?.exercise.catalogExerciseId ?? null,
      exerciseFamily: recognitionContext.exerciseFamily ?? inferExerciseFamily(exerciseLabel),
      ...(declaration ? { source: "user_declared" as const } : {}),
    },
    overallAssessment: writing.overallAssessment,
    muscleFocus,
    coachNote: writing.coachNote,
    score,
    scoreRationale: movementScores.map((item) => ({
      criterion: item.id,
      observed: item.observed,
      impact: item.score,
      confidence: 0.7,
      evidenceIds: item.evidenceIds,
    })),
    movementScores,
    scorecard: null,
    equipmentObservations: [],
    exerciseGuide: null,
    coachingCoverage: undefined,
    didWell: [],
    priorityCorrections,
    coachingCues: [],
    setContext: {
      cameraView: analysis.visibility.cameraView,
      visibleReferences,
      sequenceSummary: analysis.videoSummary,
      changeAcrossSet: null,
      coachingBasis: "One complete-video review using only visible mechanics.",
    },
    setSummary: {
      totalReps: declaredRepetitions,
      consistentReps: null,
      verdict: analysis.videoSummary,
    },
    repTimeline: [],
    nextSetPlan: priorityCorrections.map((finding) => ({
      id: `next-${finding.id}`,
      action: finding.actionableCorrection?.instruction ?? finding.title,
      rationale: finding.whyItMatters,
      ...(finding.actionableCorrection?.successCheck ? { successCheck: finding.actionableCorrection.successCheck } : {}),
      relatedFindingId: finding.id,
    })),
    precisionRequest: { requestedRuns: 0, reason: null, targets: [] },
    comparison: null,
    setDeclaration: declaration ?? null,
  };
}

const evidenceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["startMs", "peakMs", "endMs", "visualEvidence", "visibleBodyAreas", "confidence"],
  properties: {
    startMs: { type: "integer" },
    peakMs: { type: "integer" },
    endMs: { type: "integer" },
    visualEvidence: { type: "string" },
    visibleBodyAreas: { type: "array", items: { type: "string" } },
    confidence: { type: "number" },
  },
} as const;

const movementScoreSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "label", "observed", "evidenceIds"],
  properties: {
    id: { type: "string" },
    label: { type: "string" },
    observed: { type: "string" },
    evidenceIds: { type: "array", items: { type: "string" } },
  },
} as const;

const muscleFocusSchema = {
  type: "object",
  additionalProperties: false,
  required: ["primary", "secondary", "unclassified"],
  properties: {
    primary: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "region"],
        properties: { name: { type: "string" }, region: { type: "string", enum: MUSCLE_REGIONS } },
      },
    },
    secondary: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "region"],
        properties: { name: { type: "string" }, region: { type: "string", enum: MUSCLE_REGIONS } },
      },
    },
    unclassified: { type: "array", items: { type: "string" } },
  },
} as const;

export const BOUNDARY_FREE_ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["videoSummary", "visibility", "issues"],
  properties: {
    videoSummary: { type: "string" },
    visibility: {
      type: "object",
      additionalProperties: false,
      required: ["cameraView", "clearlyVisible", "partlyVisible", "notVisible"],
      properties: {
        cameraView: { type: "string" },
        clearlyVisible: { type: "array", items: { type: "string" } },
        partlyVisible: { type: "array", items: { type: "string" } },
        notVisible: { type: "array", items: { type: "string" } },
      },
    },
    issues: {
      type: "array",
      description: "Return the four to six highest-consequence distinct, evidence-backed form problems visible in the recording.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "observation", "mechanicalConsequence", "prevalence", "severity", "confidence", "observedIssueRegions", "evidence"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          observation: { type: "string" },
          mechanicalConsequence: { type: "string", description: "Why this is a core issue: the meaningful consequence for loaded control or support, joint position under load, usable range or path, or intended muscle stimulus. Do not diagnose or predict injury." },
          prevalence: { type: "string", enum: ["isolated", "repeated", "throughout"] },
          severity: { type: "string", enum: ["note", "important", "high"] },
          confidence: { type: "number" },
          observedIssueRegions: { type: "array", items: { type: "string", enum: ANATOMY_REGIONS } },
          evidence: { type: "array", items: evidenceSchema },
        },
      },
    },
  },
} as const;

export const WHOLE_VIDEO_WRITING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["overallAssessment", "coachNote", "movementScores", "muscleFocus", "coachingItems"],
  properties: {
    overallAssessment: { type: "string" },
    coachNote: { type: "string" },
    movementScores: { type: "array", items: movementScoreSchema },
    muscleFocus: muscleFocusSchema,
    coachingItems: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "whatHappened", "whatHappenedDetail", "whyItMatters", "whyItMattersDetail", "whatToDo", "successCheck"],
        properties: {
          id: { type: "string" },
          title: { type: "string", description: "A short, plain-language name for the issue that a beginner can understand." },
          whatHappened: { type: "string", description: "A concise, video-specific observation heading that describes what the camera shows. It must not repeat the issue title." },
          whatHappenedDetail: { type: "string" },
          whyItMatters: { type: "string", description: "A concise consequence heading that states the meaningful effect on the exercise. It must differ from the issue title and whatHappened heading." },
          whyItMattersDetail: { type: "string" },
          whatToDo: { type: "string" },
          successCheck: { type: "string" },
        },
      },
    },
  },
} as const;

function declaredSetSummary(declaration?: SetDeclaration): string {
  if (!declaration) return "No set declaration was provided.";
  const amount = declaration.amount.kind === "reps"
    ? `${declaration.amount.value} ${declaration.amount.countScope === "per_side" ? "reps per side" : "total reps"}`
    : `${declaration.amount.value} seconds`;
  const load = declaration.load.kind === "known"
    ? `${declaration.load.value} ${declaration.load.unit} ${declaration.load.scope.replaceAll("_", " ")}`
    : declaration.load.kind;
  return `The person declared: ${declaration.exercise.label}, ${amount}, load ${load}${declaration.side ? `, side ${declaration.side}` : ""}${declaration.styles.length > 0 ? `, intentional styles ${declaration.styles.join(", ")}` : ""}${declaration.focusNote ? `, note "${declaration.focusNote}"` : ""}.`;
}

export function buildBoundaryFreeAnalysisPrompt(
  durationMs: number,
  declaration?: SetDeclaration,
): string {
  return `You are Formie's full-video exercise analyst. The recording is ${durationMs} ms long. ${declaredSetSummary(declaration)}

Watch the complete video from beginning to end once before choosing any issues. Review the beginning, middle, and end so the result represents the entire performed set. Do not count or audit repetitions, assign repetition numbers, or create a repetition timeline. Summarize the performed set and report what the camera clearly shows, partly shows, and does not show. Use that visibility report to avoid guessing about hidden mechanics.

Identify the four to six highest-consequence distinct form problems visible in the recording. Before selecting them, use your exercise-specific knowledge to establish the intended setup, equipment configuration, joint path, range, support, and target-muscle stimulus for the declared exercise, then compare the recording against those mechanics. Prioritize visible faults involving loss of support or control under load, meaningfully compromised joint position under load, a major setup or equipment mismatch, a major path or range error, or a change likely to reduce the intended muscle stimulus. Do not prioritize a fault merely because it is easy to notice. Do not include minor form optimizations, cosmetic differences, or unsupported filler. Do not diagnose an injury or claim that an injury will occur; identify the consequential loaded mechanic. Do not duplicate one problem under multiple labels, invent unsupported faults, or request another video pass.

Recommended checks include exercise-specific setup and equipment configuration such as bench angle; equipment and contact points; hands and grip; body position, alignment, and posture; support and balance; elbow and arm path relative to the torso and intended destination; lifting and lowering path; range and endpoints; tempo and control; stability; joint tracking and joint position under load; left-right imbalance and symmetry; and meaningful changes from the beginning through the middle and end of the set. These are recommendations, not limits or required categories. Use any other relevant exercise knowledge and report important issues outside these recommendations when the video supports them.

Name the actual form fault. Do not use "variation," "inconsistency," or "change between reps" as the issue itself. For every issue, state the meaningful mechanical consequence that made it one of the highest-priority findings. Give every issue at least one original-video evidence moment. For a repeated or throughout issue, include two meaningfully separated evidence moments when the video clearly supports them. Across the report, use supported evidence from the beginning, middle, and end when the selected problems appear there; never invent or move a timestamp merely to spread frames out. Set peakMs to the clearest exact frame, with startMs and endMs providing short surrounding context. Include the visible body areas, prevalence, severity, confidence, and anatomy regions to highlight.

Return only analyst facts. Do not write explanations, corrections, strengths, scores, a muscle map, general guidance, or a recheck request. Return one JSON object matching the schema.`;
}

export const WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION = `You are Formie's coaching writer. Return only JSON matching the schema.

Write a coaching item for every supplied issue exactly once. Preserve every supplied issue's identity and visible claims. Never remove, add, merge, or split issues; never alter an issue's observation, evidence, severity, prevalence, confidence, or highlighted regions; and do not invent a new observed fault. Give each issue a short title in plain, beginner-friendly gym language. Use exercise technique knowledge to turn each supplied fault into a specific, practical correction and visible success check. You may describe the appropriate joint path, direction, position, or endpoint when it directly corrects that supplied fault. For a pulling exercise, when the supplied fault concerns the pull path, arm range, or peak position, state a concrete elbow or arm destination—such as pulling the elbow toward the hips when appropriate for that exercise—instead of merely saying to pull farther back. Every statement about what happened in this recording must trace directly to the declaration, video summary, visibility report, issue, or evidence. Do not introduce a new fault, hypothetical compensation, or unsupported future outcome. Do not substitute equipment names; repeat the supplied equipment term or use the neutral word "equipment" when none is supplied. Write for a beginner using short sentences and common words. Rewrite technical analyst terms in plain language instead of showing jargon such as cervical, scapular, eccentric, concentric, asymmetry, or thoracic. Keep necessary body-part names simple.

For every issue, write a short whatHappened heading that describes what the camera shows, then exactly three natural, video-specific sentences for whatHappenedDetail. Write a short whyItMatters heading that names the meaningful exercise consequence, then exactly three natural, exercise-specific sentences for whyItMattersDetail. These two section headings must be dynamically written for their own content, distinct from each other, and distinct from the issue title; never copy or lightly rephrase the issue title into either heading. Explain the supplied observable mechanical consequences using position, path, range, balance, stability, loaded control, repeatability, and intended muscle stimulus where relevant. You may explain that a visible mechanic can reduce the intended muscle stimulus or shift emphasis away from the exercise's intended target, but cannot observe or assert what the person feels internally. Do not claim muscle activation as an observed fact, diagnose an injury, claim an injury will occur, or make claims about pain, joint health, muscle growth, or medical outcomes. Avoid repeated templates, identical endings, and invented physiology. Write one direct whatToDo sentence and one concrete successCheck sentence.

Return exactly four useful movement score categories with plain labels, short observations, and the analyst issue IDs that affect each category. Do not calculate numeric scores; the app applies one consistent severity, prevalence, and confidence rubric locally so identical form receives identical numbers. Create the exercise muscle map from the declaration, video summary, and final issues; keep that exercise muscle map separate from analyst-owned issue-region highlights.`;

export function buildWholeVideoWritingPrompt(
  analysis: WholeVideoAnalysis,
  declaration?: SetDeclaration,
): string {
  return `Declaration context: ${declaredSetSummary(declaration)}
Immutable analyst result:
${JSON.stringify(analysis)}`;
}

export function buildWholeVideoWritingRepairPrompt(
  analysis: WholeVideoAnalysis,
  declaration: SetDeclaration | undefined,
  rejectedWriting: unknown,
  validationError: unknown,
): string {
  const reason = validationError instanceof Error ? validationError.message : String(validationError);
  return `${buildWholeVideoWritingPrompt(analysis, declaration)}

The previous writer JSON was rejected. Rewrite the complete JSON from the immutable analyst result. Include every issue exactly once in the same order and repair only writing or structure. Do not add, remove, merge, split, or reinterpret any analyst issue or evidence, and keep every issue ID unchanged.
Validation issue: ${reason}
Rejected writer JSON:
${JSON.stringify(rejectedWriting)}`;
}
