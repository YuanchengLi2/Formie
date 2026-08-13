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
  movementScores: MovementScore[];
  muscleFocus: MuscleFocus;
  coachingItems: Array<{
    id: string;
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
    title: issue.title,
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
      summary: issue.title,
      whatHappened: issue.title,
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
      score: boundedNumber(score.score, `${name}.score`, 0, 100),
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

export function parseWholeVideoWriting(value: unknown, analysis: WholeVideoAnalysis): WholeVideoWriting {
  const writing = record(value, "writing");
  if (!Array.isArray(writing.coachingItems) || writing.coachingItems.length !== analysis.issues.length) {
    throw new Error("writing.coachingItems must cover every analyst issue");
  }
  const coachingItems = writing.coachingItems.map((rawItem, index) => {
    const name = `writing.coachingItems[${index}]`;
    const item = record(rawItem, name);
    const id = text(item.id, `${name}.id`);
    if (id !== analysis.issues[index].id) throw new Error("writing.coachingItems must use every analyst issue ID in the same order");
    const successCheck = item.successCheck === null ? null : text(item.successCheck, `${name}.successCheck`);
    return {
      id,
      whatHappenedDetail: text(item.whatHappenedDetail, `${name}.whatHappenedDetail`),
      whyItMatters: text(item.whyItMatters, `${name}.whyItMatters`),
      whyItMattersDetail: text(item.whyItMattersDetail, `${name}.whyItMattersDetail`),
      whatToDo: text(item.whatToDo, `${name}.whatToDo`),
      successCheck,
    };
  });
  return {
    overallAssessment: text(writing.overallAssessment, "writing.overallAssessment"),
    coachNote: text(writing.coachNote, "writing.coachNote"),
    movementScores: parseMovementScores(writing.movementScores, analysis),
    muscleFocus: parseMuscleFocus(writing.muscleFocus),
    coachingItems,
  };
}

function fallbackMovementScores(analysis: WholeVideoAnalysis): MovementScore[] {
  const prevalenceWeight = { isolated: 0.6, repeated: 1, throughout: 1.25 } as const;
  const severityWeight = { note: 4, important: 9, high: 15 } as const;
  const penalty = analysis.issues.reduce(
    (sum, issue) => sum + severityWeight[issue.severity] * prevalenceWeight[issue.prevalence] * issue.confidence,
    0,
  );
  const base = Math.max(35, Math.min(96, Math.round(96 - penalty)));
  const evidenceIds = analysis.issues.map((issue) => issue.id);
  return [
    { id: "overall-form", label: "Overall Form", score: base, observed: "Based on all visible form issues from the complete set.", evidenceIds },
    { id: "movement-path", label: "Movement Path", score: base, observed: "Based on the visible paths and positions cited by the analyst.", evidenceIds },
    { id: "control", label: "Control", score: base, observed: "Based on the visible control and stability issues cited by the analyst.", evidenceIds },
    { id: "repeatability", label: "Repeatability", score: base, observed: "Based on issue prevalence across the complete set.", evidenceIds },
  ];
}

export function normalizeWholeVideoWriting(value: unknown, analysis: WholeVideoAnalysis): WholeVideoWriting {
  let movementScores = fallbackMovementScores(analysis);
  let muscleFocus: MuscleFocus = { primary: [], secondary: [], unclassified: [] };
  try {
    const raw = record(value, "writing");
    movementScores = parseMovementScores(raw.movementScores, analysis);
    muscleFocus = parseMuscleFocus(raw.muscleFocus);
  } catch {
    // Writer metadata is optional in the last-resort path; analyst facts remain authoritative.
  }
  const firstIssue = analysis.issues[0];
  return {
    overallAssessment: analysis.videoSummary,
    coachNote: firstIssue ? `Start with ${firstIssue.title.toLowerCase()} on the next set.` : "Repeat the set with the same controlled setup.",
    movementScores,
    muscleFocus,
    coachingItems: analysis.issues.map((issue) => {
      const evidence = issue.evidence[0]?.visualEvidence ?? issue.observation;
      return {
        id: issue.id,
        whatHappenedDetail: `${issue.observation} ${evidence} This was ${issue.prevalence} in the recorded set.`,
        whyItMatters: `Improve ${issue.title.toLowerCase()}`,
        whyItMattersDetail: `This changes the visible position or path described above. Addressing it makes that part of the exercise easier to control. It also gives you a clearer position to repeat on the next set.`,
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
  const priorityCorrections = analysis.issues.map((issue) => publicFinding(issue, writtenItems.get(issue.id)!));
  const exerciseLabel = declaration?.exercise.label ?? "Exercise attempt";
  const equipment = recognitionContext.equipment
    ?? (declaration?.load.kind === "bodyweight" ? ["bodyweight"] : []);
  const movementScores = writing.movementScores;
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
  required: ["id", "label", "score", "observed", "evidenceIds"],
  properties: {
    id: { type: "string" },
    label: { type: "string" },
    score: { type: "number" },
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
      description: "Return every distinct evidence-backed issue found, including at least four visible corrections or useful form optimizations, with no upper cap.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "observation", "prevalence", "severity", "confidence", "observedIssueRegions", "evidence"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          observation: { type: "string" },
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
        required: ["id", "whatHappenedDetail", "whyItMatters", "whyItMattersDetail", "whatToDo", "successCheck"],
        properties: {
          id: { type: "string" },
          whatHappenedDetail: { type: "string" },
          whyItMatters: { type: "string" },
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

Search broadly before answering and return every distinct evidence-backed form issue you find. Return at least four distinct visible corrections or useful form optimizations. If fewer than four are initially obvious, re-examine the beginning, middle, and end through every recommended search lens and include smaller evidence-backed optimizations that are visible and useful. Partial visibility does not by itself disqualify an issue when the relevant position, path, range, balance, or control remains observable. Do not stop after the first issue. Do not rank issues into a shortlist, discard a supported issue because another issue seems more important, add unsupported filler to meet the minimum, duplicate one problem under multiple labels, invent unsupported faults, or request another video pass.

Recommended checks include setup; equipment and contact points; hands and grip; body position, alignment, and posture; support and balance; lifting and lowering path; range and endpoints; tempo and control; stability; joint tracking; left-right imbalance and symmetry; and meaningful changes from the beginning through the middle and end of the set. These are search lenses, not quotas. You may find issues outside these suggestions.

Name the actual form fault. Do not use "variation," "inconsistency," or "change between reps" as the issue itself. Give every issue at least one original-video evidence moment. Set peakMs to the clearest exact frame, with startMs and endMs providing short surrounding context. Include the visible body areas, prevalence, severity, confidence, and anatomy regions to highlight.

Return only analyst facts. Do not write explanations, corrections, strengths, scores, a muscle map, general guidance, or a recheck request. Return one JSON object matching the schema.`;
}

export const WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION = `You are Formie's coaching writer. Return only JSON matching the schema.

Write a coaching item for every supplied issue, exactly once and in the same order. Preserve every supplied issue's identity and visible claims. Never rename, remove, add, merge, split, or reorder issues; never alter an issue's observation, evidence, severity, prevalence, confidence, or highlighted regions; and never invent a mechanic that is not supported by the analyst. Every factual or causal sentence must trace directly to the declaration, video summary, visibility report, issue, or evidence. Do not introduce a new fault, a hypothetical compensation, or a future outcome that those facts do not supply. Do not add an ideal path, direction, or endpoint unless the supplied facts define it. Do not substitute equipment names; repeat the supplied equipment term or use the neutral word "equipment" when none is supplied. Use everyday gym language. An occasional useful technical term is allowed only when you explain it immediately in plain language.

For every issue, write exactly three natural, video-specific sentences for whatHappenedDetail. Write a short whyItMatters heading, then exactly three natural, exercise-specific sentences for whyItMattersDetail. Explain why using only observable mechanical consequences in the same position, path, range, balance, stability, control, and repeatability named by the supplied issue. Muscle names belong only in muscleFocus; do not mention muscles, muscle groups, core effort, or body-part effort in any coaching prose field. Do not describe target muscles working harder, working less, being isolated, being activated, receiving tension, handling a load, or powering the movement. Do not claim muscle activation, muscle engagement, muscle growth, joint health, injury risk, pain, strain, or other medical effects unless the analyst explicitly supplied that visible fact. Avoid repeated templates, identical endings, and invented physiology. Write one direct whatToDo sentence and one concrete successCheck sentence.

Return exactly four movement scores on a 0-to-100 scale; never use a 0-to-10 scale. Create them solely from the final issues, their severity, prevalence, and confidence. Minor isolated issues must not make the entire performance appear poor. Create the exercise muscle map from the declaration, video summary, and final issues; keep that exercise muscle map separate from analyst-owned issue-region highlights.`;

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

The previous writer JSON was rejected. Rewrite the complete JSON from the immutable analyst result. Include every issue exactly once in the same order and repair only writing or structure. Do not add, remove, merge, split, rename, or reinterpret any issue or evidence.
Validation issue: ${reason}
Rejected writer JSON:
${JSON.stringify(rejectedWriting)}`;
}
