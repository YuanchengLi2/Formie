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

export function limitWholeVideoAnalysis(analysis: WholeVideoAnalysis): WholeVideoAnalysis {
  return analysis.issues.length > 6
    ? { ...analysis, issues: analysis.issues.slice(0, 6) }
    : analysis;
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
  const successCheck = writing.successCheck.trim() || null;
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

export function boundaryFreeToCandidate(
  rawAnalysis: WholeVideoAnalysis,
  writing: WholeVideoWriting,
  declaration?: SetDeclaration,
  recognitionContext: BoundaryFreeRecognitionContext = {},
): AnalysisCandidate & { analysisBasis: "observed"; viewNotes: string[]; generalGuidance: string[] } {
  const analysis = limitWholeVideoAnalysis(rawAnalysis);
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

Search broadly before answering. Form an internal candidate list, then compare each candidate's importance, confidence, and usefulness. You must return the strongest 4-6 distinct visible form issues in ranked order. Use genuine corrections first and smaller evidence-backed form optimizations when needed to reach four. Do not duplicate one problem under multiple labels, invent unsupported faults, or request another video pass.

Recommended checks include setup; equipment and contact points; hands and grip; body position, alignment, and posture; support and balance; lifting and lowering path; range and endpoints; tempo and control; stability; joint tracking; left-right imbalance and symmetry; and meaningful changes from the beginning through the middle and end of the set. These are search lenses, not quotas. You may find issues outside these suggestions.

Name the actual form fault. Do not use "variation," "inconsistency," or "change between reps" as the issue itself. Support each issue with inline evidence from the original video, the visible body areas, prevalence, severity, confidence, and the anatomy regions to highlight.

Return only analyst facts. Do not write explanations, corrections, strengths, scores, a muscle map, general guidance, or a recheck request. Return one JSON object matching the schema.`;
}

export const WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION = `You are Formie's coaching writer. Return only JSON matching the schema.

Preserve every supplied issue's identity and visible claims. Never rename an issue, replace its title, alter its observation, evidence, severity, prevalence, confidence, or highlighted regions, and never invent a mechanic that is not supported by the analyst. Every factual or causal sentence must trace directly to the declaration, video summary, visibility report, issue, or evidence. Do not introduce a new fault, a hypothetical compensation, or a future outcome that those facts do not supply. Do not add an ideal path, direction, or endpoint unless the supplied facts define it. Do not substitute equipment names; repeat the supplied equipment term or use the neutral word "equipment" when none is supplied. Use everyday gym language. An occasional useful technical term is allowed only when you explain it immediately in plain language.

For every issue, write exactly three natural, video-specific sentences for whatHappenedDetail. Write a short whyItMatters heading, then exactly three natural, exercise-specific sentences for whyItMattersDetail. Explain why using only observable mechanical consequences in the same position, path, range, balance, stability, control, and repeatability named by the supplied issue. Muscle names belong only in muscleFocus; do not mention muscles, muscle groups, core effort, or body-part effort in any coaching prose field. Do not describe target muscles working harder, working less, being isolated, being activated, receiving tension, handling a load, or powering the movement. Do not claim muscle activation, muscle engagement, muscle growth, joint health, injury risk, pain, strain, or other medical effects unless the analyst explicitly supplied that visible fact. Avoid repeated templates, identical endings, and invented physiology. Write one direct whatToDo sentence and one concrete successCheck sentence.

Return exactly four movement scores on a 0-to-100 scale; never use a 0-to-10 scale. Create them solely from the final issues, their severity, prevalence, and confidence. Minor isolated issues must not make the entire performance appear poor. Create the exercise muscle map from the declaration, video summary, and final issues; keep that exercise muscle map separate from analyst-owned issue-region highlights.`;

export function buildWholeVideoWritingPrompt(
  analysis: WholeVideoAnalysis,
  declaration?: SetDeclaration,
): string {
  return `Declaration context: ${declaredSetSummary(declaration)}
Immutable analyst result:
${JSON.stringify(limitWholeVideoAnalysis(analysis))}`;
}
