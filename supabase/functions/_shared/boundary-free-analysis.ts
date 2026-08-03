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

type JsonRecord = Record<string, unknown>;

export type BoundaryFreeEvidence = {
  startMs: number;
  peakMs: number;
  endMs: number;
  visualEvidence: string;
  visibleBodyAreas: string[];
  confidence: number;
  repNumber: number | null;
  phase: string | null;
};

export type BoundaryFreeCoachingItem = {
  id: string;
  topic: string;
  observation: string;
  whyItMatters: string;
  correctionDirection: string;
  severity: "high" | "important" | "note";
  confidence: number;
  observedIssueRegions: AnatomyRegion[];
  evidence: BoundaryFreeEvidence[];
  primaryEvidenceIndex?: number;
};

export type BoundaryFreeStrength = {
  id: string;
  topic: string;
  observation: string;
  evidence: BoundaryFreeEvidence[];
  primaryEvidenceIndex?: number;
};

export type BoundaryFreeRecheckRequest = {
  centerMs: number;
  reason: string;
};

export type BoundaryFreeAnalysis = {
  analysisBasis: "observed" | "declared_only";
  videoUnderstanding: {
    recordingSummary: string;
    exerciseSummary: string;
    visibleSequence: string;
    beginning: string;
    middle: string;
    end: string;
    changesAcrossVideo: string;
    setupEquipmentAndSurroundings: string;
    observedRepCount: number | null;
    viewNotes: string[];
  };
  movementScores: MovementScore[];
  muscleFocus: MuscleFocus;
  coachingItems: BoundaryFreeCoachingItem[];
  strengths: BoundaryFreeStrength[];
  generalGuidance: string[];
  recheckRequest: BoundaryFreeRecheckRequest | null;
};

export type BoundaryFreeRecognitionContext = {
  exerciseFamily?: ExerciseFamily;
  equipment?: string[];
};

export type WholeVideoWriting = {
  overallAssessment: string;
  coachNote: string;
  movementScores: MovementScore[];
  coachingItems: Array<{
    id: string;
    title: string;
    whatHappened: string;
    whyItMatters: string;
    whatToDo: string;
    successCheck: string;
  }>;
  strengths: Array<{ id: string; title: string; detail: string }>;
};

const ANATOMY_REGIONS = ["chest", "shoulders", "upper_back", "lats", "upper_arms", "elbows", "forearms", "wrists", "torso", "lower_back", "hips", "glutes", "quads", "hamstrings", "adductors", "knees", "calves", "ankles"] as const satisfies readonly AnatomyRegion[];
const MUSCLE_REGIONS = ["chest", "front_shoulders", "rear_shoulders", "upper_back", "lats", "biceps", "triceps", "forearms", "abs", "obliques", "lower_back", "glutes", "quads", "hamstrings", "adductors", "calves"] as const;
const TOPIC_NORMALIZATION = /[^a-z0-9]+/g;
const UNSUPPORTED_WRITER_CLAIM = /\b(?:activat(?:e|es|ed|ing|ion)|injur(?:y|ies)|internal forces?|joint (?:stress|protection)|mind-muscle|muscle (?:engagement|growth|recruitment|tension)|spine (?:safety|strain)|strain|tissue)\b/i;
const PERSONALIZATION_STOP_WORDS = new Set(["advice", "better", "controlled", "exercise", "focus", "form", "good", "keep", "movement", "next", "proper", "rep", "repetition", "set", "steady", "technique", "use", "your"]);

function personalizationTerms(value: string): Set<string> {
  return new Set(value.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
    .filter((word) => word.length > 3 && !PERSONALIZATION_STOP_WORDS.has(word)));
}

function isPersonalizedCopy(value: string, source: string): boolean {
  const sourceTerms = personalizationTerms(source);
  for (const word of personalizationTerms(value)) {
    if (sourceTerms.has(word)) return true;
  }
  return false;
}

function sentenceCount(value: string): number {
  return (value.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [])
    .map((sentence) => sentence.trim())
    .filter(Boolean).length;
}

function coachingParagraph(value: unknown, name: string, minimum: number, maximum: number): string {
  const paragraph = text(value, name);
  const count = sentenceCount(paragraph);
  if (count < minimum || count > maximum) {
    throw new Error(`${name} must contain ${minimum} to ${maximum} sentences`);
  }
  return paragraph;
}

function shortHeadline(value: unknown, name: string): string {
  const headline = text(value, name);
  const words = headline.split(/\s+/).filter(Boolean);
  if (/\r|\n/.test(headline) || sentenceCount(headline) > 1 || words.length < 2 || words.length > 12) {
    throw new Error(`${name} must be a single short headline`);
  }
  return headline;
}

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

function record(value: unknown, name: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as JsonRecord;
}

function text(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} must be a non-empty string`);
  return value.trim();
}

function optionalText(value: unknown, name: string): string | null {
  if (value === null || value === undefined) return null;
  return text(value, name);
}

function boundedNumber(value: unknown, name: string, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  return value;
}

function integer(value: unknown, name: string, minimum: number, maximum: number): number {
  const parsed = boundedNumber(value, name, minimum, maximum);
  if (!Number.isInteger(parsed)) throw new Error(`${name} must be an integer`);
  return parsed;
}

export function parseRecheckRequest(value: unknown, durationMs: number): BoundaryFreeRecheckRequest | null {
  if (value === null || value === undefined) return null;
  const request = record(value, "recheckRequest");
  return {
    centerMs: integer(request.centerMs, "recheckRequest.centerMs", 0, durationMs),
    reason: text(request.reason, "recheckRequest.reason"),
  };
}

function stringArray(value: unknown, name: string, minimum = 0): string[] {
  if (!Array.isArray(value) || value.length < minimum || value.some((item) => typeof item !== "string" || !item.trim())) throw new Error(`${name} must contain non-empty strings`);
  return value.map((item) => String(item).trim());
}

function evidence(value: unknown, durationMs: number, name: string): BoundaryFreeEvidence {
  const item = record(value, name);
  const startMs = integer(item.startMs, `${name}.startMs`, 0, Math.max(0, durationMs - 2));
  const endMs = integer(item.endMs, `${name}.endMs`, Math.min(durationMs, startMs + 2), durationMs);
  const peakMs = integer(item.peakMs, `${name}.peakMs`, startMs + 1, Math.max(startMs + 1, endMs - 1));
  if (!(startMs < peakMs && peakMs < endMs)) throw new Error(`${name} must have startMs < peakMs < endMs`);
  const visibleBodyAreas = stringArray(item.visibleBodyAreas, `${name}.visibleBodyAreas`, 1);
  const repNumber = item.repNumber === null || item.repNumber === undefined ? null : integer(item.repNumber, `${name}.repNumber`, 1, 10_000);
  return {
    startMs,
    peakMs,
    endMs,
    visualEvidence: text(item.visualEvidence, `${name}.visualEvidence`),
    visibleBodyAreas,
    confidence: boundedNumber(item.confidence, `${name}.confidence`, 0, 1),
    repNumber,
    phase: optionalText(item.phase, `${name}.phase`),
  };
}

function parseEvidenceSelections(value: unknown, durationMs: number, findingIds: Set<string>): Map<string, { primary: number; evidence: BoundaryFreeEvidence[] }> {
  if (!Array.isArray(value)) throw new Error("evidenceSelections must be an array");
  const selections = new Map<string, { primary: number; evidence: BoundaryFreeEvidence[] }>();
  value.forEach((raw, index) => {
    try {
      const item = record(raw, `evidenceSelections[${index}]`);
      const findingId = text(item.findingId, `evidenceSelections[${index}].findingId`);
      // A single malformed finding or stale selection must not discard the
      // other evidence-backed findings in the same response.
      if (!findingIds.has(findingId)) return;
      if (selections.has(findingId)) throw new Error("DUPLICATE_EVIDENCE_SELECTION_ID");
      if (!Array.isArray(item.moments) || item.moments.length < 1) return;
      const moments = item.moments.map((moment, momentIndex) => evidence(moment, durationMs, `evidenceSelections[${index}].moments[${momentIndex}]`));
      for (let momentIndex = 1; momentIndex < moments.length; momentIndex += 1) {
        const previous = moments[momentIndex - 1];
        const current = moments[momentIndex];
        if (current.startMs < previous.startMs || current.peakMs < previous.peakMs || current.endMs < previous.endMs) {
          throw new Error("evidence moments must be chronological");
        }
      }
      const requestedPrimary = Number.isInteger(item.primaryEvidenceIndex)
        ? Number(item.primaryEvidenceIndex)
        : moments.reduce((best, moment, momentIndex) => moment.confidence > moments[best].confidence ? momentIndex : best, 0);
      const primary = Math.max(0, Math.min(requestedPrimary, moments.length - 1));
      selections.set(findingId, { primary, evidence: moments });
    } catch (error) {
      // Drop only this selection; the surrounding analysis remains usable.
      if (error instanceof Error && error.message === "DUPLICATE_EVIDENCE_SELECTION_ID") throw error;
    }
  });
  return selections;
}

function parseMuscleFocus(value: unknown): MuscleFocus {
  const focus = record(value, "muscleFocus");
  const parseTargets = (raw: unknown, name: "primary" | "secondary") => {
    if (!Array.isArray(raw)) throw new Error(`muscleFocus.${name} must be an array`);
    const regions = new Set<string>();
    return raw.map((entry, index) => {
      const target = record(entry, `muscleFocus.${name}[${index}]`);
      if (!MUSCLE_REGIONS.includes(target.region as typeof MUSCLE_REGIONS[number])) throw new Error(`muscleFocus.${name}[${index}].region is invalid`);
      if (regions.has(String(target.region))) throw new Error(`muscleFocus.${name} regions must be unique`);
      regions.add(String(target.region));
      return { name: text(target.name, `muscleFocus.${name}[${index}].name`), region: target.region as typeof MUSCLE_REGIONS[number] };
    });
  };
  const primary = parseTargets(focus.primary, "primary");
  const secondary = parseTargets(focus.secondary, "secondary");
  if (secondary.some((target) => primary.some((primaryTarget) => primaryTarget.region === target.region))) throw new Error("muscleFocus primary and secondary regions must be distinct");
  return { primary, secondary, unclassified: stringArray(focus.unclassified, "muscleFocus.unclassified") };
}

function parseScores(value: unknown, findingIds: Set<string>): MovementScore[] {
  if (!Array.isArray(value)) throw new Error("movementScores must be an array");
  if (value.length !== 4) throw new Error("movementScores must contain exactly four scores");
  const ids = new Set<string>();
  const labels = new Set<string>();
  return value.map((raw, index) => {
    const item = record(raw, `movementScores[${index}]`);
    const id = text(item.id, `movementScores[${index}].id`);
    const label = text(item.label, `movementScores[${index}].label`);
    const normalizedLabel = label.toLowerCase().replace(TOPIC_NORMALIZATION, " ").trim();
    if (ids.has(id) || labels.has(normalizedLabel)) throw new Error("movementScores IDs and labels must be unique");
    ids.add(id);
    labels.add(normalizedLabel);
    return {
      id,
      label,
      score: boundedNumber(item.score, `movementScores[${index}].score`, 0, 100),
      observed: text(item.observed, `movementScores[${index}].observed`),
      evidenceIds: Array.isArray(item.evidenceIds) ? [...new Set(item.evidenceIds.filter((id): id is string => typeof id === "string" && findingIds.has(id)))] : [],
    };
  });
}

export function parseWholeVideoWriting(value: unknown, analysis: BoundaryFreeAnalysis): WholeVideoWriting {
  const result = record(value, "whole-video writing");
  const findingIds = new Set(analysis.coachingItems.map((item) => item.id));
  const strengthIds = new Set(analysis.strengths.map((item) => item.id));
  const parseExactItems = <T>(
    raw: unknown,
    name: string,
    expectedIds: Set<string>,
    parse: (item: JsonRecord, index: number) => T & { id: string },
  ): T[] => {
    if (!Array.isArray(raw)) throw new Error(`${name} must be an array`);
    if (raw.length !== expectedIds.size) throw new Error(`${name} must contain exactly the validated analysis IDs`);
    const seen = new Set<string>();
    const items: Array<T & { id: string }> = raw.map((entry, index) => {
      const parsed = parse(record(entry, `${name}[${index}]`), index);
      if (!expectedIds.has(parsed.id)) throw new Error(`${name}[${index}].id is not in the validated analysis`);
      if (seen.has(parsed.id)) throw new Error(`${name} IDs must be unique`);
      seen.add(parsed.id);
      return parsed;
    });
    if ([...expectedIds].some((id) => !seen.has(id))) throw new Error(`${name} must preserve every validated analysis ID`);
    return items;
  };
  const sourceById = new Map(analysis.coachingItems.map((item) => [item.id, item]));
  const coachingItems = parseExactItems(result.coachingItems, "coachingItems", findingIds, (item, index) => {
    const id = text(item.id, `coachingItems[${index}].id`);
    const source = sourceById.get(id);
    if (!source) throw new Error(`coachingItems[${index}].id is not in the video analysis`);
    const sourceContext = [source.topic, source.observation, source.whyItMatters, source.correctionDirection, ...source.evidence.map((moment) => moment.visualEvidence)].join(" ");
    const whatHappened = coachingParagraph(item.whatHappened, `coachingItems[${index}].whatHappened`, 2, 3);
    const title = shortHeadline(item.title, `coachingItems[${index}].title`);
    const whyItMatters = coachingParagraph(item.whyItMatters, `coachingItems[${index}].whyItMatters`, 2, 3);
    const whatToDo = coachingParagraph(item.whatToDo, `coachingItems[${index}].whatToDo`, 1, 1);
    const successCheck = coachingParagraph(item.successCheck, `coachingItems[${index}].successCheck`, 1, 1);
    return {
      id,
      title,
      whatHappened: isPersonalizedCopy(whatHappened, sourceContext) ? whatHappened : source.observation,
      whyItMatters: isPersonalizedCopy(whyItMatters, sourceContext) ? whyItMatters : source.whyItMatters,
      whatToDo: isPersonalizedCopy(whatToDo, sourceContext) ? whatToDo : source.correctionDirection,
      successCheck: isPersonalizedCopy(successCheck, sourceContext)
        ? successCheck
        : `The next set shows a more consistent result for ${source.topic} at the cited moment.`,
    };
  });
  const strengths = parseExactItems(result.strengths, "strengths", strengthIds, (item, index) => ({
    id: text(item.id, `strengths[${index}].id`),
    title: text(item.title, `strengths[${index}].title`),
    detail: text(item.detail, `strengths[${index}].detail`),
  }));
  const overallAssessment = text(result.overallAssessment, "overallAssessment");
  const coachNote = text(result.coachNote, "coachNote");
  const fullSetContext = [
    analysis.videoUnderstanding.exerciseSummary,
    analysis.videoUnderstanding.changesAcrossVideo,
    ...analysis.coachingItems.flatMap((item) => [item.topic, item.observation, item.correctionDirection]),
  ].join(" ");
  const movementScores = parseScores(result.movementScores, findingIds).map((score, index) => ({
    ...score,
    observed: UNSUPPORTED_WRITER_CLAIM.test(score.observed)
      ? analysis.movementScores[index]?.observed ?? analysis.videoUnderstanding.exerciseSummary
      : score.observed,
  }));
  return {
    overallAssessment: UNSUPPORTED_WRITER_CLAIM.test(overallAssessment) || !isPersonalizedCopy(overallAssessment, fullSetContext)
      ? analysis.videoUnderstanding.changesAcrossVideo
      : overallAssessment,
    coachNote: UNSUPPORTED_WRITER_CLAIM.test(coachNote) || !isPersonalizedCopy(coachNote, fullSetContext)
      ? analysis.coachingItems[0]?.correctionDirection ?? analysis.videoUnderstanding.recordingSummary
      : coachNote,
    movementScores,
    coachingItems,
    strengths,
  };
}

export function parseBoundaryFreeAnalysis(value: unknown, durationMs: number): BoundaryFreeAnalysis {
  const result = record(value, "boundary-free analysis");
  const analysisBasis = "observed" as const;
  const understanding = record(result.videoUnderstanding, "videoUnderstanding");
  const videoUnderstanding = {
    recordingSummary: text(understanding.recordingSummary, "videoUnderstanding.recordingSummary"),
    exerciseSummary: text(understanding.exerciseSummary, "videoUnderstanding.exerciseSummary"),
    visibleSequence: text(understanding.visibleSequence, "videoUnderstanding.visibleSequence"),
    beginning: text(understanding.beginning, "videoUnderstanding.beginning"),
    middle: text(understanding.middle, "videoUnderstanding.middle"),
    end: text(understanding.end, "videoUnderstanding.end"),
    changesAcrossVideo: text(understanding.changesAcrossVideo, "videoUnderstanding.changesAcrossVideo"),
    setupEquipmentAndSurroundings: text(understanding.setupEquipmentAndSurroundings, "videoUnderstanding.setupEquipmentAndSurroundings"),
    observedRepCount: understanding.observedRepCount === null || understanding.observedRepCount === undefined ? null : integer(understanding.observedRepCount, "videoUnderstanding.observedRepCount", 0, 10_000),
    viewNotes: understanding.viewNotes === undefined ? [] : stringArray(understanding.viewNotes, "videoUnderstanding.viewNotes"),
  };
  if (!Array.isArray(result.coachingItems)) throw new Error("coachingItems must be an array");
  if (!Array.isArray(result.strengths)) throw new Error("strengths must be an array");
  const rawItems = result.coachingItems;
  const rawStrengths = result.strengths;
  const ids = new Set<string>();
  const topics = new Set<string>();
  const itemDrafts: BoundaryFreeCoachingItem[] = [];
  rawItems.forEach((raw, index) => {
    try {
      const item = record(raw, `coachingItems[${index}]`);
      const id = text(item.id, `coachingItems[${index}].id`);
      const topic = text(item.topic, `coachingItems[${index}].topic`);
      const normalized = topic.toLowerCase().replace(TOPIC_NORMALIZATION, " ").trim();
      if (ids.has(id)) throw new Error("DUPLICATE_FINDING_ID");
      if (topics.has(normalized)) return;
      const regions = item.observedIssueRegions === undefined ? [] : stringArray(item.observedIssueRegions, `coachingItems[${index}].observedIssueRegions`) as AnatomyRegion[];
      if (regions.some((region) => !ANATOMY_REGIONS.includes(region))) return;
      const severity = item.severity;
      if (severity !== "high" && severity !== "important" && severity !== "note") return;
      ids.add(id);
      topics.add(normalized);
      itemDrafts.push({ id, topic, observation: text(item.observation, `coachingItems[${index}].observation`), whyItMatters: text(item.whyItMatters, `coachingItems[${index}].whyItMatters`), correctionDirection: text(item.correctionDirection, `coachingItems[${index}].correctionDirection`), severity, confidence: boundedNumber(item.confidence, `coachingItems[${index}].confidence`, 0, 1), observedIssueRegions: regions, evidence: [] });
    } catch (error) {
      // Omit only the malformed finding.
      if (error instanceof Error && error.message === "DUPLICATE_FINDING_ID") throw error;
    }
  });
  const strengthDrafts: BoundaryFreeStrength[] = [];
  rawStrengths.forEach((raw, index) => {
    try {
      const item = record(raw, `strengths[${index}]`);
      const id = text(item.id, `strengths[${index}].id`);
      if (ids.has(id)) throw new Error("DUPLICATE_FINDING_ID");
      ids.add(id);
      strengthDrafts.push({ id, topic: text(item.topic, `strengths[${index}].topic`), observation: text(item.observation, `strengths[${index}].observation`), evidence: [] });
    } catch (error) {
      // Omit only the malformed strength.
      if (error instanceof Error && error.message === "DUPLICATE_FINDING_ID") throw error;
    }
  });
  const selections = parseEvidenceSelections(result.evidenceSelections, durationMs, ids);
  const attach = <T extends { id: string }>(items: T[]) => items.flatMap((item) => {
    const selection = selections.get(item.id);
    if (!selection) return [];
    return [{ ...item, evidence: selection?.evidence ?? [], primaryEvidenceIndex: selection?.primary ?? 0 }];
  });
  const coachingItems = attach(itemDrafts) as BoundaryFreeCoachingItem[];
  if (coachingItems.length < 4) throw new Error("coachingItems must contain at least four distinct findings with valid timestamp evidence");
  const strengths = attach(strengthDrafts) as BoundaryFreeStrength[];
  const parsedGuidance = result.generalGuidance === undefined ? [] : stringArray(result.generalGuidance, "generalGuidance");
  const generalGuidance = parsedGuidance;
  const attachedFindingIds = new Set([...coachingItems, ...strengths].map((item) => item.id));
  const movementScores = parseScores(result.movementScores, attachedFindingIds);
  return {
    analysisBasis,
    videoUnderstanding,
    movementScores,
    muscleFocus: parseMuscleFocus(result.muscleFocus),
    coachingItems,
    strengths,
    generalGuidance,
    recheckRequest: parseRecheckRequest(result.recheckRequest, durationMs),
  };
}

export function declarationOnlyAnalysis(
  declaration: SetDeclaration,
  viewNote = "The recording could not be read reliably enough for visual claims; these instructions use the declared set only.",
  guidanceOverride?: string[],
): BoundaryFreeAnalysis {
  const amount = declaration.amount.kind === "reps"
    ? `${declaration.amount.value} ${declaration.amount.value === 1 ? "rep" : "reps"}`
    : `${declaration.amount.value}-second hold`;
  const load = declaration.load.kind === "known"
    ? `${declaration.load.value} ${declaration.load.unit}`
    : declaration.load.kind === "bodyweight" ? "bodyweight" : "your declared load";
  const focus = declaration.focusNote ? ` Keep this focus in mind: ${declaration.focusNote}` : "";
  return {
    analysisBasis: "declared_only",
    videoUnderstanding: {
      recordingSummary: `The set was declared as ${declaration.exercise.label} for ${amount} with ${load}.`,
      exerciseSummary: `${declaration.exercise.label} was supplied as the exercise context.`,
      visibleSequence: "No visual sequence is asserted.",
      beginning: "No beginning-of-recording observation is asserted.",
      middle: "No middle-of-recording observation is asserted.",
      end: "No end-of-recording observation is asserted.",
      changesAcrossVideo: "No beginning-to-end visual change is asserted.",
      setupEquipmentAndSurroundings: "No setup, equipment, or surroundings claim is asserted.",
      observedRepCount: null,
      viewNotes: [viewNote],
    },
    movementScores: [],
    muscleFocus: { primary: [], secondary: [], unclassified: [] },
    coachingItems: [],
    strengths: [],
    generalGuidance: guidanceOverride && guidanceOverride.length >= 2 ? guidanceOverride : [
      `For the next ${declaration.exercise.label} set, use the declared ${amount} target and keep the movement controlled from the first position to the last.${focus}`,
      `Use ${load} as the declared load context, keep the setup stable, and stop the set if you cannot maintain a comfortable, controlled range.`,
    ],
    recheckRequest: null,
  };
}

const DECLARATION_GUIDANCE_REFUSAL = /\b(unable|unusable|refuse|refusal)\b|cannot be judged|record again/i;

export function parseDeclarationGuidance(value: unknown): string[] {
  const result = record(value, "declaration guidance");
  const guidance = stringArray(result.generalGuidance, "generalGuidance", 2).slice(0, 6);
  if (guidance.some((item) => DECLARATION_GUIDANCE_REFUSAL.test(item))) {
    throw new Error("declaration guidance contains a refusal");
  }
  return guidance;
}

export const DECLARATION_GUIDANCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["generalGuidance"],
  properties: {
    generalGuidance: { type: "array", minItems: 2, maxItems: 6, items: { type: "string" } },
  },
} as const;

function declaredGuidanceSummary(declaration: SetDeclaration): string {
  const amount = declaration.amount.kind === "reps"
    ? `${declaration.amount.value} ${declaration.amount.countScope === "per_side" ? "reps per side" : "total reps"}`
    : `${declaration.amount.value} seconds`;
  const load = declaration.load.kind === "known"
    ? `${declaration.load.value} ${declaration.load.unit} ${declaration.load.scope.replaceAll("_", " ")}`
    : declaration.load.kind;
  return `${declaration.exercise.label}; ${amount}; load ${load}; side ${declaration.side ?? "not specified"}; styles ${declaration.styles.join(", ") || "none"}; focus ${declaration.focusNote ?? "none"}`;
}

export function buildDeclarationGuidancePrompt(declaration: SetDeclaration): string {
  return `Write practical coaching for a declared exercise set when the recording cannot provide visual evidence. The declaration is context only: ${declaredGuidanceSummary(declaration)}.

Return two to six concise instructions for the next set. Cover setup, controlled range, tempo or breathing, and the declared amount when useful. Do not claim that any movement, body position, rep, load, or surroundings were seen. Do not create timestamps or evidence. Return only JSON matching the schema with a generalGuidance array. Keep every instruction useful and action-oriented.`;
}

function publicEvidence(moment: BoundaryFreeEvidence): EvidenceMoment {
  return { ...moment, coachingNote: moment.visualEvidence, focusRegion: null };
}

function coachingArea(topic: string): CoachingFinding["coachingArea"] {
  const lower = topic.toLowerCase();
  if (/load|weight|heavier|lighter/.test(lower)) return "load";
  if (/equipment|bench|rack|machine|handle|bar|dumbbell|cable/.test(lower)) return "equipment";
  if (/grip|hand|wrist/.test(lower)) return "grip_contact";
  if (/balance|support|foot|stance/.test(lower)) return "support_balance";
  if (/setup|surround|safety|space/.test(lower)) return "safety_surroundings";
  if (/posture|position|torso|hip|shoulder/.test(lower)) return "posture_setup";
  return "form";
}

function publicFinding(
  item: BoundaryFreeCoachingItem | BoundaryFreeStrength,
  kind: "correction" | "strength",
  writing?: WholeVideoWriting["coachingItems"][number] | WholeVideoWriting["strengths"][number],
): CoachingFinding {
  const correction = kind === "correction" ? item as BoundaryFreeCoachingItem : null;
  const correctionWriting = kind === "correction" ? writing as WholeVideoWriting["coachingItems"][number] | undefined : undefined;
  const strengthWriting = kind === "strength" ? writing as WholeVideoWriting["strengths"][number] | undefined : undefined;
  const evidence = item.evidence.map(publicEvidence);
  const finding: CoachingFinding = {
    id: item.id,
    coachingArea: kind === "correction" ? coachingArea(item.topic) : "form",
    title: correctionWriting?.title ?? strengthWriting?.title ?? item.topic,
    detail: strengthWriting?.detail ?? item.observation,
    whyItMatters: correctionWriting?.whyItMatters ?? correction?.whyItMatters ?? "This visible pattern supported the set.",
    correction: correctionWriting?.whatToDo ?? correction?.correctionDirection ?? null,
    cue: correctionWriting?.whatToDo ?? correction?.correctionDirection ?? null,
    actionableCorrection: correction ? { instruction: correctionWriting?.whatToDo ?? correction.correctionDirection, cue: correctionWriting?.whatToDo ?? correction.correctionDirection, successCheck: correctionWriting?.successCheck ?? null, applyWhen: "On the next set at the cited moment." } : null,
    expandedCoaching: correction ? {
      summary: correctionWriting?.title ?? correction.topic,
      whatHappened: correctionWriting?.whatHappened ?? correction.observation,
      whyItMatters: correctionWriting?.whyItMatters ?? correction.whyItMatters,
      whatToDo: correctionWriting?.whatToDo ?? correction.correctionDirection,
      successCheck: correctionWriting?.successCheck ?? null,
    } : undefined,
    severity: correction?.severity ?? "note",
    evidence,
    primaryEvidenceIndex: Math.min(item.primaryEvidenceIndex ?? 0, Math.max(0, evidence.length - 1)),
    observedIssueRegions: correction?.observedIssueRegions ?? [],
    coachingType: kind === "correction" ? "correction" : "optimization",
  };
  return finding;
}

export function boundaryFreeToCandidate(
  analysis: BoundaryFreeAnalysis,
  declaration?: SetDeclaration,
  recognitionContext: BoundaryFreeRecognitionContext = {},
  writing?: WholeVideoWriting,
): AnalysisCandidate & { analysisBasis: BoundaryFreeAnalysis["analysisBasis"]; viewNotes: string[]; generalGuidance: string[] } {
  const writtenCorrections = new Map(writing?.coachingItems.map((item) => [item.id, item]));
  const writtenStrengths = new Map(writing?.strengths.map((item) => [item.id, item]));
  const priorityCorrections = analysis.coachingItems.map((item) => publicFinding(item, "correction", writtenCorrections.get(item.id)));
  const didWell = analysis.strengths.map((item) => publicFinding(item, "strength", writtenStrengths.get(item.id)));
  const exerciseLabel = declaration?.exercise.label ?? analysis.videoUnderstanding.exerciseSummary;
  const equipment = recognitionContext.equipment
    ?? (declaration?.load.kind === "bodyweight" ? ["bodyweight"] : []);
  const movementScores = writing?.movementScores ?? analysis.movementScores;
  const score = movementScores.length > 0
    ? Math.round(movementScores.reduce((sum, item) => sum + item.score, 0) / movementScores.length)
    : null;
  const viewNotes: string[] = [];
  const analysisBasis = analysis.analysisBasis;
  const coachNote = writing?.coachNote ?? priorityCorrections[0]?.correction ?? analysis.generalGuidance[0] ?? analysis.videoUnderstanding.recordingSummary;
  const setupSteps = analysis.generalGuidance.slice(0, 2);
  const executionSteps = analysis.generalGuidance.slice(2, 5);
  if (executionSteps.length === 0 && analysis.generalGuidance.length > 0) executionSteps.push(analysis.generalGuidance.at(-1)!);
  const setSummary = { totalReps: declaration?.amount.kind === "reps" ? declaration.amount.value : null, consistentReps: null, verdict: analysis.videoUnderstanding.changesAcrossVideo };
  return {
    status: "complete",
    analysisBasis,
    viewNotes,
    generalGuidance: analysisBasis === "declared_only" ? analysis.generalGuidance : [],
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
    overallAssessment: writing?.overallAssessment ?? (analysis.videoUnderstanding.changesAcrossVideo || analysis.videoUnderstanding.exerciseSummary),
    muscleFocus: analysis.muscleFocus,
    coachNote,
    score,
    scoreRationale: movementScores.map((item) => ({ criterion: item.id, observed: item.observed, impact: item.score, confidence: 0.7, evidenceIds: item.evidenceIds })),
    movementScores,
    scorecard: null,
    equipmentObservations: [],
    exerciseGuide: analysisBasis === "declared_only"
      ? { setupSteps: setupSteps.length > 0 ? setupSteps : [analysis.videoUnderstanding.exerciseSummary], executionSteps, relatedFindingIds: [] }
      : null,
    coachingCoverage: undefined,
    didWell,
    priorityCorrections,
    coachingCues: [],
    setContext: { cameraView: null, visibleReferences: [...new Set(priorityCorrections.flatMap((item) => item.evidence.flatMap((moment) => moment.visibleBodyAreas)))].slice(0, 8), sequenceSummary: analysis.videoUnderstanding.visibleSequence, changeAcrossSet: analysis.videoUnderstanding.changesAcrossVideo, coachingBasis: analysis.videoUnderstanding.setupEquipmentAndSurroundings },
    setSummary,
    nextSetPlan: priorityCorrections.map((finding) => ({ id: `next-${finding.id}`, action: finding.actionableCorrection?.instruction ?? finding.title, rationale: finding.whyItMatters, successCheck: finding.actionableCorrection?.successCheck ?? undefined, relatedFindingId: finding.id })),
    precisionRequest: { requestedRuns: 0, reason: null, targets: [] },
    comparison: null,
    setDeclaration: declaration ?? null,
  };
}

const evidenceSchema = {
  type: "object", additionalProperties: false,
  required: ["startMs", "peakMs", "endMs", "visualEvidence", "visibleBodyAreas", "confidence"],
  properties: { startMs: { type: "integer", minimum: 0 }, peakMs: { type: "integer", minimum: 0 }, endMs: { type: "integer", minimum: 1 }, visualEvidence: { type: "string" }, visibleBodyAreas: { type: "array", items: { type: "string" } }, confidence: { type: "number", minimum: 0, maximum: 1 }, repNumber: { type: ["integer", "null"], minimum: 1 }, phase: { type: ["string", "null"] } },
};

const writtenScoreSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "label", "score", "observed", "evidenceIds"],
  properties: {
    id: { type: "string" },
    label: { type: "string" },
    score: { type: "number", minimum: 0, maximum: 100 },
    observed: { type: "string" },
    evidenceIds: { type: "array", items: { type: "string" } },
  },
};

export const WHOLE_VIDEO_WRITING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["overallAssessment", "coachNote", "movementScores", "coachingItems", "strengths"],
  properties: {
    overallAssessment: { type: "string" },
    coachNote: { type: "string" },
    movementScores: { type: "array", minItems: 4, maxItems: 4, items: writtenScoreSchema },
    coachingItems: {
      type: "array",
      minItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "whatHappened", "whyItMatters", "whatToDo", "successCheck"],
        properties: {
          id: { type: "string" }, title: { type: "string" }, whatHappened: { type: "string" },
          whyItMatters: { type: "string" }, whatToDo: { type: "string" }, successCheck: { type: "string" },
        },
      },
    },
    strengths: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "detail"],
        properties: { id: { type: "string" }, title: { type: "string" }, detail: { type: "string" } },
      },
    },
  },
} as const;

export function buildWholeVideoWritingPrompt(analysis: BoundaryFreeAnalysis, declaration?: SetDeclaration): string {
  const { viewNotes: _viewNotes, ...videoUnderstanding } = analysis.videoUnderstanding;
  const immutableAnalysis = {
    declaration: declaredSetSummary(declaration),
    videoUnderstanding,
    movementScores: analysis.movementScores,
    coachingItems: analysis.coachingItems,
    strengths: analysis.strengths,
  };
  return `You are Formie's coaching editor. Rewrite the validated full-video analysis below into natural, useful coaching and calibrate its four scores. Return only JSON matching the schema.

Do not add, remove, merge, or rename finding IDs or strength IDs. Do not invent or change observations, timestamps, evidence, body regions, rep counts, muscle focus, or exercise facts. The video analyst already established those facts. Your job is wording and score calibration only.

For each coaching item, title is only the concise issue label used for navigation; it is not the white coaching sentence. Make the title specific, normally four to ten words, without generic labels or numbering.

For every finding, whatHappened must contain two or three sentences. Its first sentence is shown as the bold white coaching line. Name the declared exercise and describe the exact visible body, equipment, path, range, position, or tempo change in that sentence. In the remaining sentences, reference every numbered repetition supported by the supplied evidence and identify the relevant phase or moment. Do not replace supported repetition numbers with vague phrases such as "that moment." Do not reuse the same sentence template across findings.

whyItMatters must contain two or three sentences. Its first sentence must directly explain why this exact visible pattern matters for the declared exercise; this first sentence is shown as the bold white coaching line. Use the remaining sentence or sentences for the specific consequence to path, range, control, position, balance, tempo, or repeatability. Do not repeat whatHappened and do not use generic wording that could apply to any exercise.

whatToDo must be exactly one complete actionable sentence. This sentence is shown as the bold white coaching line, so it must name the declared exercise or its unmistakable equipment and movement action, give the corrective direction, and state when in the repetition to apply it. successCheck must be one separate sentence shown as normal text that describes what the user should visibly compare on the next set.

Write direct, supportive coaching for this exact recorded set. Never write generic advice that could be pasted onto another person's result. Tie each whatToDo and successCheck to that finding's visible body position, path, range, tempo, equipment contact, or beginning-to-end change. Use the declared exercise, load, equipment, side, or set amount when it genuinely makes the instruction more personal. The overallAssessment and coachNote must name concrete details unique to this set.

Keep every observation visual: do not claim muscle activation, recruitment, growth, internal forces, joint stress or protection, strain, injury risk, pain, tissue effects, or medical safety. Explain visible consistency, control, path, range, balance, or stability instead. Keep scores generous but honest: 90-100 is excellent with only tiny refinements; 80-89 is strong; 70-79 is generally good with fixable issues; 60-69 means several clear problems; below 60 is reserved for major or repeated problems. Recognize visible strengths and do not punish camera uncertainty. Return exactly four distinct, exercise-specific scores. Do not return general guidance or view notes.

Validated analysis:
${JSON.stringify(immutableAnalysis)}`;
}

export const BOUNDARY_FREE_ANALYSIS_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["videoUnderstanding", "movementScores", "muscleFocus", "coachingItems", "strengths", "evidenceSelections", "recheckRequest"],
  properties: {
    videoUnderstanding: { type: "object", additionalProperties: false, required: ["recordingSummary", "exerciseSummary", "visibleSequence", "beginning", "middle", "end", "changesAcrossVideo", "setupEquipmentAndSurroundings", "observedRepCount"], properties: { recordingSummary: { type: "string" }, exerciseSummary: { type: "string" }, visibleSequence: { type: "string" }, beginning: { type: "string" }, middle: { type: "string" }, end: { type: "string" }, changesAcrossVideo: { type: "string" }, setupEquipmentAndSurroundings: { type: "string" }, observedRepCount: { type: ["integer", "null"], minimum: 0 } } },
    movementScores: { type: "array", minItems: 4, maxItems: 4, items: { type: "object", additionalProperties: false, required: ["id", "label", "score", "observed", "evidenceIds"], properties: { id: { type: "string" }, label: { type: "string" }, score: { type: "number", minimum: 0, maximum: 100 }, observed: { type: "string" }, evidenceIds: { type: "array", items: { type: "string" } } } } },
    muscleFocus: { type: "object", additionalProperties: false, required: ["primary", "secondary", "unclassified"], properties: { primary: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "region"], properties: { name: { type: "string" }, region: { type: "string", enum: MUSCLE_REGIONS } } } }, secondary: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "region"], properties: { name: { type: "string" }, region: { type: "string", enum: MUSCLE_REGIONS } } } }, unclassified: { type: "array", items: { type: "string" } } } },
    coachingItems: { type: "array", minItems: 4, items: { type: "object", additionalProperties: false, required: ["id", "topic", "observation", "whyItMatters", "correctionDirection", "severity", "confidence", "observedIssueRegions"], properties: { id: { type: "string" }, topic: { type: "string" }, observation: { type: "string" }, whyItMatters: { type: "string" }, correctionDirection: { type: "string" }, severity: { type: "string", enum: ["high", "important", "note"] }, confidence: { type: "number", minimum: 0, maximum: 1 }, observedIssueRegions: { type: "array", items: { type: "string", enum: ANATOMY_REGIONS } } } } },
    strengths: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "topic", "observation"], properties: { id: { type: "string" }, topic: { type: "string" }, observation: { type: "string" } } } },
    evidenceSelections: { type: "array", items: { type: "object", additionalProperties: false, required: ["findingId", "moments"], properties: { findingId: { type: "string" }, primaryEvidenceIndex: { type: "integer", minimum: 0 }, moments: { type: "array", minItems: 1, items: evidenceSchema } } } },
    recheckRequest: { type: ["object", "null"], additionalProperties: false, required: ["centerMs", "reason"], properties: { centerMs: { type: "integer", minimum: 0 }, reason: { type: "string" } } },
  },
} as const;

function declaredSetSummary(declaration?: SetDeclaration): string {
  if (!declaration) return "No set declaration was provided.";
  const amount = declaration.amount.kind === "reps" ? `${declaration.amount.value} ${declaration.amount.countScope === "per_side" ? "reps per side" : "total reps"}` : `${declaration.amount.value} seconds`;
  const load = declaration.load.kind === "known" ? `${declaration.load.value} ${declaration.load.unit} ${declaration.load.scope.replaceAll("_", " ")}` : declaration.load.kind;
  return `The person declared: ${declaration.exercise.label}, ${amount}, load ${load}${declaration.side ? `, side ${declaration.side}` : ""}${declaration.styles.length > 0 ? `, intentional styles ${declaration.styles.join(", ")}` : ""}${declaration.focusNote ? `, note "${declaration.focusNote}"` : ""}.`;
}

export function buildBoundaryFreeAnalysisPrompt(durationMs: number, declaration?: SetDeclaration): string {
  return `You are Formie's complete exercise-video coach. The recording is ${durationMs} ms long. ${declaredSetSummary(declaration)}

Watch the entire recording from the first frame through the final frame before writing anything. Use the declared exercise and amount as helpful context for finding the set, never as a pass/fail test. The visible count may differ, a repetition may be partial or imperfect, timing may be uncertain, and setup or finishing movement may appear; continue analyzing everything visible.

First build a chronological understanding of setup, surroundings, beginning, middle, end, repeated movement, equipment, contact, posture, range, path, balance, control, tempo, and changes across the full recording. Inspect setup stability, body alignment, exercise path, range and endpoints, balance or support, grip and equipment contact, tempo and control, and repetition-to-repetition consistency separately.

Return muscleFocus for the exercise actually performed, using the visible variation and equipment to distinguish primary target muscles from secondary target muscles. For every coaching item, return observedIssueRegions only for the visible body areas directly involved in that specific form issue. These fields drive two different anatomy views: muscleFocus drives the target-muscle map, while observedIssueRegions drives the form map. Keep both anatomically specific and do not copy generic regions into every finding.

Then return at least four distinct, timestamp-backed coaching issues or optimization opportunities. There is no maximum: return every distinct issue the recording supports. Use genuine corrections first. If fewer than four clear faults are visible, add honest note-severity refinements grounded in separate visible aspects of the performed set; describe them as optimizations and do not falsely claim that correct movement was faulty. Do not split one observation into duplicate topics. Every coaching item must have its own evidence selection from the original video. Return exactly four distinct exercise-specific movement scores on a 0-100 scale where 100 is best, plus genuine strengths.

If a detail or body area is hidden, omit only that claim and keep analyzing other visible dimensions. The recording remains the source of every issue, score, and strength.

After completing the full analysis, request a recheck only when you genuinely need to see one short moment again to resolve meaningful visual uncertainty; otherwise set recheckRequest to null. If a second look would materially improve the findings or evidence, request it with the exact centerMs and a focused reason. Use this sparingly. Do not request a recheck when the full recording already supports a confident decision, and do not request one merely to repeat work or increase confidence without a specific unresolved question.

Choose the strongest evidence timestamps after writing coaching for each observed finding or strength. Evidence timestamps must describe visible moments on the original recording. Return one complete JSON object matching the schema.`;
}

export function buildBoundaryFreeRecheckPrompt(input: {
  analysis: BoundaryFreeAnalysis;
  declaration?: SetDeclaration;
  request: BoundaryFreeRecheckRequest;
  window: { startMs: number; endMs: number };
  remainingAfterThis: number;
}): string {
  const remaining = input.remainingAfterThis === 1
    ? "one optional recheck remains after this one"
    : `${input.remainingAfterThis} optional rechecks remain after this one`;
  return `You are rechecking one genuinely uncertain moment from an exercise video after already watching the complete recording. The supplied video is only the requested short window from ${input.window.startMs} ms through ${input.window.endMs} ms. ${declaredSetSummary(input.declaration)}

The unresolved question is: ${input.request.reason}

Review this short window carefully, then return a complete revised analysis matching the same schema. Use the latest validated analysis below as the whole-recording context. Confirm or revise only facts that this clip can genuinely resolve. Do not erase a whole-set observation merely because other moments are outside this clip. Keep all supported findings and evidence, and update findings, timestamps, scores, muscle focus, or ordering only when the visible clip justifies the change.

You have ${remaining}. Set recheckRequest to null if this clip resolves the question or the remaining uncertainty is not meaningful. Use rechecks sparingly and request another recheck only if genuine visual uncertainty remains and another exact moment could materially change the analysis. Do not write coaching prose; Gemini 3.1 Flash-Lite handles coaching after verification ends.

Latest validated analysis:
${JSON.stringify(input.analysis)}`;
}
