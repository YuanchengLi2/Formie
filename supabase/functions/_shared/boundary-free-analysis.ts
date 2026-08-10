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
  observationDetails: string;
  whyItMatters: string;
  whyDetails: string;
  correctionDirection: string;
  affectedRepNumbers: number[];
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
    repAudit: Array<{
      repNumber: number;
      startMs: number;
      peakMs: number;
      endMs: number;
      visualSummary: string;
    }>;
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
    whatHappenedDetail?: string;
    whyItMatters: string;
    whyItMattersDetail?: string;
    whatToDo: string;
    successCheck: string;
  }>;
  strengths: Array<{ id: string; title: string; detail: string }>;
};

const ANATOMY_REGIONS = ["chest", "shoulders", "upper_back", "lats", "upper_arms", "elbows", "forearms", "wrists", "torso", "lower_back", "hips", "glutes", "quads", "hamstrings", "adductors", "knees", "calves", "ankles"] as const satisfies readonly AnatomyRegion[];
const MUSCLE_REGIONS = ["chest", "front_shoulders", "rear_shoulders", "upper_back", "lats", "biceps", "triceps", "forearms", "abs", "obliques", "lower_back", "glutes", "quads", "hamstrings", "adductors", "calves"] as const;
const TOPIC_NORMALIZATION = /[^a-z0-9]+/g;
const UNSUPPORTED_WRITER_CLAIM = /\b(?:activat(?:e|es|ed|ing|ion)|development|injur(?:y|ies)|internal forces?|joint (?:stress|protection|mobility)|mind-muscle|muscle (?:engagement|growth|involvement|recruitment|tension|effort)|muscular tension|power production|spine (?:safety|strain)|strain|tissue|glute involvement|work output)\b/i;
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

function observableCoachingParagraph(value: unknown, name: string, minimum: number, maximum: number): string {
  const paragraph = coachingParagraph(value, name, minimum, maximum);
  if (UNSUPPORTED_WRITER_CLAIM.test(paragraph)) throw new Error(`${name} contains an unsupported hidden or physiological claim`);
  return paragraph;
}

function sentenceParts(value: string): string[] {
  return (value.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [])
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .map((sentence) => /[.!?]$/.test(sentence) ? sentence : `${sentence}.`);
}

function secondsFromMilliseconds(milliseconds: number): number {
  return Number((milliseconds / 1_000).toFixed(milliseconds >= 1_000 ? 1 : 2));
}

export function humanizeCoachingTimeUnits(value: string): string {
  return value.replace(/\b(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(?:milliseconds?|ms)\b/gi, (_match, raw: string) => {
    const milliseconds = Number(raw.replaceAll(",", ""));
    if (!Number.isFinite(milliseconds)) return _match;
    const seconds = secondsFromMilliseconds(milliseconds);
    return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
  });
}

function normalizedObservableParagraph(value: unknown, fallback: string, minimum: number, maximum: number): string {
  const raw = typeof value === "string" ? value.trim() : "";
  const parts = sentenceParts(raw);
  if (!raw || UNSUPPORTED_WRITER_CLAIM.test(raw)) return fallback;
  if (parts.length < minimum) {
    const additions = sentenceParts(fallback).filter((sentence) => !parts.includes(sentence));
    return [...parts, ...additions].slice(0, Math.min(minimum, maximum)).join(" ");
  }
  return parts.slice(0, maximum).join(" ");
}

function visibleWhyFallback(topic: string, observation: string): string {
  const context = `${topic} ${observation}`.toLowerCase();
  if (/depth|range|endpoint|bottom|top position/.test(context)) return "This visible range changes the position reached during the recorded repetition.";
  if (/tempo|speed|reversal|bounce|momentum|control/.test(context)) return "This visible timing change makes the movement transition less controlled and less repeatable.";
  if (/balance|foot|shift|lean|stability|posture|alignment/.test(context)) return "This visible position change alters balance or alignment during the repetition.";
  return "This visible difference changes the movement path or position used during the recorded repetition.";
}

function visibleWhyDetailFallback(topic: string, affectedRepNumbers: number[]): string {
  const repList = affectedRepNumbers.length === 1
    ? `rep ${affectedRepNumbers[0]}`
    : `reps ${affectedRepNumbers.slice(0, -1).join(", ")} and ${affectedRepNumbers.at(-1)}`;
  return `The ${topic.toLowerCase()} pattern changes the visible path or position on ${repList}. That makes the next repetition harder to match with the earlier ones.`;
}

function visibleObservationDetailFallback(topic: string, affectedRepNumbers: number[]): string {
  const repList = affectedRepNumbers.length === 1
    ? `rep ${affectedRepNumbers[0]}`
    : `reps ${affectedRepNumbers.slice(0, -1).join(", ")} and ${affectedRepNumbers.at(-1)}`;
  return `The cited frames show the ${topic.toLowerCase()} pattern on ${repList}. The same phase was checked on every visible repetition. That comparison shows where the difference starts, repeats, or becomes clearest.`;
}

function firstSentence(value: string, fallback: string): string {
  return sentenceParts(value)[0] ?? fallback;
}

function overallAssessmentFallback(analysis: BoundaryFreeAnalysis): string {
  const firstFinding = analysis.coachingItems[0];
  return [
    firstSentence(analysis.videoUnderstanding.recordingSummary, "The full exercise set was reviewed."),
    firstSentence(analysis.videoUnderstanding.changesAcrossVideo, analysis.videoUnderstanding.exerciseSummary),
    firstSentence(firstFinding?.observation ?? analysis.videoUnderstanding.exerciseSummary, "The clearest visible change is described in the coaching below."),
  ].join(" ");
}

function coachNoteFallback(analysis: BoundaryFreeAnalysis): string {
  const firstFinding = analysis.coachingItems[0];
  return [
    firstSentence(firstFinding?.observation ?? analysis.videoUnderstanding.recordingSummary, "The full exercise set was reviewed."),
    firstSentence(firstFinding?.whyItMatters ?? analysis.videoUnderstanding.changesAcrossVideo, "This affects how repeatable the movement looks."),
    firstSentence(firstFinding?.correctionDirection ?? analysis.videoUnderstanding.exerciseSummary, "Repeat the movement with the clearest visible correction."),
  ].join(" ");
}

function visibleObservationFallback(topic: string, affectedRepNumbers: number[]): string {
  const repList = affectedRepNumbers.length === 1
    ? `rep ${affectedRepNumbers[0]}`
    : `reps ${affectedRepNumbers.slice(0, -1).join(", ")} and ${affectedRepNumbers.at(-1)}`;
  return `The ${topic.toLowerCase()} pattern is visible during ${repList}.`;
}

function visibleCorrectionFallback(topic: string): string {
  return `Adjust the ${topic.toLowerCase()} pattern during the matching phase of the next repetition.`;
}

function observableWhyOrFallback(value: unknown, name: string, fallback: string, minimum: number, maximum: number): string {
  try {
    return observableCoachingParagraph(value, name, minimum, maximum);
  } catch {
    return fallback;
  }
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

function parseRepAudit(value: unknown, durationMs: number, observedRepCount: number | null): BoundaryFreeAnalysis["videoUnderstanding"]["repAudit"] {
  if (!Array.isArray(value)) throw new Error("videoUnderstanding.repAudit must be an array");
  if (observedRepCount === null) throw new Error("videoUnderstanding.observedRepCount is required when repAudit is returned");
  if (value.length !== observedRepCount) throw new Error("videoUnderstanding.repAudit must contain every observed repetition");
  return value.map((raw, index) => {
    const name = `videoUnderstanding.repAudit[${index}]`;
    const item = record(raw, name);
    const repNumber = integer(item.repNumber, `${name}.repNumber`, 1, 10_000);
    if (repNumber !== index + 1) throw new Error(`${name}.repNumber must be sequential`);
    const startMs = integer(item.startMs, `${name}.startMs`, 0, Math.max(0, durationMs - 2));
    const endMs = integer(item.endMs, `${name}.endMs`, Math.min(durationMs, startMs + 2), durationMs);
    const peakMs = integer(item.peakMs, `${name}.peakMs`, startMs + 1, Math.max(startMs + 1, endMs - 1));
    if (!(startMs < peakMs && peakMs < endMs)) throw new Error(`${name} must have startMs < peakMs < endMs`);
    return { repNumber, startMs, peakMs, endMs, visualSummary: text(item.visualSummary, `${name}.visualSummary`) };
  });
}

function uniquePositiveIntegers(value: unknown, name: string, maximum: number): number[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${name} must contain at least one repetition`);
  const parsed = value.map((item, index) => integer(item, `${name}[${index}]`, 1, maximum));
  if (new Set(parsed).size !== parsed.length) throw new Error(`${name} must contain unique repetitions`);
  return parsed;
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

function spreadPrimaryEvidenceAcrossSet(items: BoundaryFreeCoachingItem[]): BoundaryFreeCoachingItem[] {
  const momentUse = new Map<number, number>();
  const repUse = new Map<number, number>();
  return items.map((item) => {
    const requested = Math.max(0, Math.min(item.primaryEvidenceIndex ?? 0, item.evidence.length - 1));
    const candidates = item.evidence.map((moment, index) => ({
      index,
      moment,
      momentUse: momentUse.get(moment.peakMs) ?? 0,
      repUse: moment.repNumber === null ? 0 : repUse.get(moment.repNumber) ?? 0,
      requestedPenalty: index === requested ? 0 : 1,
    }));
    candidates.sort((left, right) => (
      left.momentUse - right.momentUse
      || left.repUse - right.repUse
      || left.requestedPenalty - right.requestedPenalty
      || right.moment.confidence - left.moment.confidence
      || left.moment.peakMs - right.moment.peakMs
    ));
    const selected = candidates[0] ?? null;
    if (!selected) return item;
    momentUse.set(selected.moment.peakMs, selected.momentUse + 1);
    if (selected.moment.repNumber !== null) {
      repUse.set(selected.moment.repNumber, selected.repUse + 1);
    }
    return { ...item, primaryEvidenceIndex: selected.index };
  });
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
  // The video analyst is the source of truth. A writer response is a
  // presentation enhancement, so malformed or unavailable prose must never
  // discard an otherwise valid visual analysis or force a retry_wait state.
  const result = value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
  const findingIds = new Set(analysis.coachingItems.map((item) => item.id));
  const strengthIds = new Set(analysis.strengths.map((item) => item.id));
  const byId = (raw: unknown, expectedIds: Set<string>): Map<string, JsonRecord> => {
    if (!Array.isArray(raw)) return new Map();
    const entries = new Map<string, JsonRecord>();
    raw.forEach((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
      const item = entry as JsonRecord;
      if (typeof item.id !== "string" || !expectedIds.has(item.id) || entries.has(item.id)) return;
      entries.set(item.id, item);
    });
    return entries;
  };
  const safeHeadline = (value: unknown): string | null => {
    try {
      return humanizeCoachingTimeUnits(shortHeadline(value, "writer headline"));
    } catch {
      return null;
    }
  };
  const safeParagraph = (value: unknown, minimum: number, maximum: number): string | null => {
    try {
      return coachingParagraph(value, "writer paragraph", minimum, maximum);
    } catch {
      return null;
    }
  };
  const safeCopy = (value: string | null, fallback: string, sourceContext: string): string => (
    humanizeCoachingTimeUnits(value && !UNSUPPORTED_WRITER_CLAIM.test(value) && isPersonalizedCopy(value, sourceContext) ? value : fallback)
  );
  const rawCoachingById = byId(result.coachingItems, findingIds);
  const coachingItems = analysis.coachingItems.map((source) => {
    const item = rawCoachingById.get(source.id);
    const sourceContext = [source.topic, source.observation, source.observationDetails, source.whyItMatters, source.whyDetails, source.correctionDirection, ...source.evidence.map((moment) => moment.visualEvidence)].join(" ");
    const whatHappened = safeCopy(
      safeParagraph(item?.whatHappened, 1, 1),
      source.observation,
      sourceContext,
    );
    const whatHappenedDetail = safeCopy(
      safeParagraph(item?.whatHappenedDetail, 3, 4),
      normalizedObservableParagraph(source.observationDetails, visibleObservationDetailFallback(source.topic, source.affectedRepNumbers), 3, 4),
      sourceContext,
    );
    const whyItMatters = safeCopy(
      safeParagraph(item?.whyItMatters, 1, 1),
      source.whyItMatters,
      sourceContext,
    );
    const whyItMattersDetail = safeCopy(
      safeParagraph(item?.whyItMattersDetail, 2, 4),
      normalizedObservableParagraph(source.whyDetails, visibleWhyDetailFallback(source.topic, source.affectedRepNumbers), 2, 4),
      sourceContext,
    );
    const whatToDo = safeCopy(
      safeParagraph(item?.whatToDo, 1, 1),
      source.correctionDirection,
      sourceContext,
    );
    const successCheck = safeCopy(
      safeParagraph(item?.successCheck, 1, 1),
      `The next set should show a more consistent result for ${source.topic} at the cited moment.`,
      sourceContext,
    );
    return {
      id: source.id,
      title: safeHeadline(item?.title) ?? source.topic,
      whatHappened,
      whatHappenedDetail,
      whyItMatters,
      whyItMattersDetail,
      whatToDo,
      successCheck,
    };
  });
  const rawStrengthsById = byId(result.strengths, strengthIds);
  const strengths = analysis.strengths.map((source) => {
    const item = rawStrengthsById.get(source.id);
    return {
      id: source.id,
      title: humanizeCoachingTimeUnits(typeof item?.title === "string" && item.title.trim() ? item.title.trim() : source.topic),
      detail: humanizeCoachingTimeUnits(typeof item?.detail === "string" && item.detail.trim() ? item.detail.trim() : source.observation),
    };
  });
  const fullSetContext = [
    analysis.videoUnderstanding.exerciseSummary,
    analysis.videoUnderstanding.changesAcrossVideo,
    ...analysis.coachingItems.flatMap((item) => [item.topic, item.observation, item.observationDetails, item.correctionDirection]),
  ].join(" ");
  const validOverallAssessment = safeParagraph(result.overallAssessment, 3, 4);
  const validCoachNote = safeParagraph(result.coachNote, 3, 3);
  const fallbackOverallAssessment = overallAssessmentFallback(analysis);
  const fallbackCoachNote = coachNoteFallback(analysis);
  let movementScores: MovementScore[] = analysis.movementScores;
  try {
    movementScores = parseScores(result.movementScores, findingIds).map((score, index) => ({
      ...score,
      observed: humanizeCoachingTimeUnits(UNSUPPORTED_WRITER_CLAIM.test(score.observed)
        ? analysis.movementScores[index]?.observed ?? analysis.videoUnderstanding.exerciseSummary
        : score.observed),
    }));
  } catch {
    movementScores = analysis.movementScores;
  }
  return {
    overallAssessment: humanizeCoachingTimeUnits(UNSUPPORTED_WRITER_CLAIM.test(validOverallAssessment ?? "") || !isPersonalizedCopy(validOverallAssessment ?? "", fullSetContext)
      ? fallbackOverallAssessment
      : validOverallAssessment!),
    coachNote: humanizeCoachingTimeUnits(UNSUPPORTED_WRITER_CLAIM.test(validCoachNote ?? "") || !isPersonalizedCopy(validCoachNote ?? "", fullSetContext)
      ? fallbackCoachNote
      : validCoachNote!),
    movementScores,
    coachingItems,
    strengths,
  };
}

export function parseBoundaryFreeAnalysis(value: unknown, durationMs: number): BoundaryFreeAnalysis {
  const result = record(value, "boundary-free analysis");
  const analysisBasis = "observed" as const;
  const understanding = record(result.videoUnderstanding, "videoUnderstanding");
  const observedRepCount = understanding.observedRepCount === null || understanding.observedRepCount === undefined ? null : integer(understanding.observedRepCount, "videoUnderstanding.observedRepCount", 0, 10_000);
  const repAudit = parseRepAudit(understanding.repAudit, durationMs, observedRepCount);
  const middleRep = repAudit[Math.floor(repAudit.length / 2)];
  const videoUnderstanding = {
    recordingSummary: text(understanding.recordingSummary, "videoUnderstanding.recordingSummary"),
    exerciseSummary: text(understanding.exerciseSummary, "videoUnderstanding.exerciseSummary"),
    visibleSequence: text(understanding.visibleSequence, "videoUnderstanding.visibleSequence"),
    beginning: understanding.beginning === undefined ? repAudit[0].visualSummary : text(understanding.beginning, "videoUnderstanding.beginning"),
    middle: understanding.middle === undefined ? middleRep.visualSummary : text(understanding.middle, "videoUnderstanding.middle"),
    end: understanding.end === undefined ? repAudit.at(-1)!.visualSummary : text(understanding.end, "videoUnderstanding.end"),
    changesAcrossVideo: text(understanding.changesAcrossVideo, "videoUnderstanding.changesAcrossVideo"),
    setupEquipmentAndSurroundings: text(understanding.setupEquipmentAndSurroundings, "videoUnderstanding.setupEquipmentAndSurroundings"),
    observedRepCount,
    repAudit,
    viewNotes: understanding.viewNotes === undefined ? [] : stringArray(understanding.viewNotes, "videoUnderstanding.viewNotes"),
  };
  if (!Array.isArray(result.coachingItems)) throw new Error("coachingItems must be an array");
  if (result.strengths !== undefined && !Array.isArray(result.strengths)) throw new Error("strengths must be an array");
  const rawItems = result.coachingItems.slice(0, 6);
  const rawStrengths = Array.isArray(result.strengths) ? result.strengths : [];
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
      const affectedRepNumbers = uniquePositiveIntegers(item.affectedRepNumbers, `coachingItems[${index}].affectedRepNumbers`, Math.max(1, observedRepCount ?? 1));
      const observation = normalizedObservableParagraph(
        item.observation,
        visibleObservationFallback(topic, affectedRepNumbers),
        1,
        1,
      );
      ids.add(id);
      topics.add(normalized);
      itemDrafts.push({
        id,
        topic,
        observation,
        observationDetails: normalizedObservableParagraph(
          item.observationDetails,
          visibleObservationDetailFallback(topic, affectedRepNumbers),
          3,
          4,
        ),
        whyItMatters: observableWhyOrFallback(item.whyItMatters, `coachingItems[${index}].whyItMatters`, visibleWhyFallback(topic, observation), 1, 1),
        whyDetails: observableWhyOrFallback(item.whyDetails, `coachingItems[${index}].whyDetails`, visibleWhyDetailFallback(topic, affectedRepNumbers), 2, 4),
        correctionDirection: normalizedObservableParagraph(item.correctionDirection, visibleCorrectionFallback(topic), 1, 1),
        affectedRepNumbers,
        severity,
        confidence: boundedNumber(item.confidence, `coachingItems[${index}].confidence`, 0, 1),
        observedIssueRegions: regions,
        evidence: [],
      });
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
  const repAuditByNumber = new Map(repAudit.map((rep) => [rep.repNumber, rep]));
  const coachingItems = spreadPrimaryEvidenceAcrossSet(itemDrafts.map((item) => {
    const selection = selections.get(item.id);
    const fallbackEvidence: BoundaryFreeEvidence[] = item.affectedRepNumbers.flatMap((repNumber) => {
      const rep = repAuditByNumber.get(repNumber);
      if (!rep) return [];
      return [{
        startMs: rep.startMs,
        peakMs: rep.peakMs,
        endMs: rep.endMs,
        visualEvidence: `${item.observation} ${rep.visualSummary}`,
        visibleBodyAreas: item.observedIssueRegions.length > 0 ? item.observedIssueRegions : ["full movement"],
        confidence: Math.min(item.confidence, 0.7),
        repNumber,
        phase: null,
      }];
    });
    const evidence = selection?.evidence.length ? selection.evidence : fallbackEvidence;
    const evidenceReps = new Set(evidence.flatMap((moment) => moment.repNumber === null ? [] : [moment.repNumber]));
    const supportedRepNumbers = item.affectedRepNumbers.filter((repNumber) => evidenceReps.has(repNumber));
    return {
      ...item,
      affectedRepNumbers: supportedRepNumbers.length > 0 ? supportedRepNumbers : [...evidenceReps],
      evidence,
      primaryEvidenceIndex: selection?.primary ?? 0,
    };
  }).filter((item) => item.evidence.length > 0 && item.affectedRepNumbers.length > 0) as BoundaryFreeCoachingItem[]);
  const strengths = attach(strengthDrafts) as BoundaryFreeStrength[];
  if (coachingItems.length < 4) {
    throw new Error("coachingItems must contain at least four distinct evidence-backed coaching items");
  }
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
      repAudit: [],
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
    detail: strengthWriting?.detail ?? (correction ? `${correction.observation} ${correction.observationDetails}` : item.observation),
    whyItMatters: correctionWriting?.whyItMatters ?? correction?.whyItMatters ?? "This visible pattern supported the set.",
    correction: correctionWriting?.whatToDo ?? correction?.correctionDirection ?? null,
    cue: correctionWriting?.whatToDo ?? correction?.correctionDirection ?? null,
    actionableCorrection: correction ? { instruction: correctionWriting?.whatToDo ?? correction.correctionDirection, cue: correctionWriting?.whatToDo ?? correction.correctionDirection, successCheck: correctionWriting?.successCheck ?? null, applyWhen: "On the next set at the cited moment." } : null,
    expandedCoaching: correction ? {
      summary: correctionWriting?.title ?? correction.topic,
      whatHappened: correctionWriting?.whatHappened ?? correction.observation,
      whatHappenedDetail: correctionWriting?.whatHappenedDetail ?? correction.observationDetails,
      whyItMatters: correctionWriting?.whyItMatters ?? correction.whyItMatters,
      whyItMattersDetail: correctionWriting?.whyItMattersDetail ?? correction.whyDetails,
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
  const affectedReps = new Set(analysis.coachingItems.flatMap((item) => item.affectedRepNumbers));
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
    repTimeline: analysis.videoUnderstanding.repAudit.map((rep) => ({
      repNumber: rep.repNumber,
      startMs: rep.startMs,
      peakMs: rep.peakMs,
      endMs: rep.endMs,
      assessment: affectedReps.has(rep.repNumber) ? "breakdown" as const : "consistent" as const,
      note: rep.visualSummary,
    })),
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
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "whatHappened", "whatHappenedDetail", "whyItMatters", "whyItMattersDetail", "whatToDo", "successCheck"],
        properties: {
          id: { type: "string" }, title: { type: "string" }, whatHappened: { type: "string" },
          whatHappenedDetail: { type: "string" }, whyItMatters: { type: "string" }, whyItMattersDetail: { type: "string" }, whatToDo: { type: "string" }, successCheck: { type: "string" },
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

export const WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION = `You are Formie's coaching editor. Rewrite validated full-video analysis into natural, useful coaching and calibrate its four scores. Return only JSON matching the schema.

Do not add, remove, merge, or rename finding IDs or strength IDs. Do not invent or change observations, timestamps, evidence, body regions, rep counts, muscle focus, or exercise facts. The video analyst already established those facts. Your job is wording and score calibration only.

For each coaching item, title is only the concise issue label used for navigation; it is not the white coaching sentence. Make the title specific, normally four to ten words, without generic labels or numbering.

For every finding, whatHappened must be exactly one complete sentence shown as bold white coaching text. whatHappenedDetail must contain three to four normal supporting sentences. Name the declared exercise and describe the exact visible body, equipment, path, range, position, or tempo change; reference every numbered repetition supported by the supplied evidence, identify the relevant phase or moment, and explain how the visible relationship changes or repeats across the recording. Do not replace supported repetition numbers with vague phrases such as "that moment." Do not reuse the same sentence template across findings.

Make each finding sound independently written for its own evidence. Lead with the specific body part or equipment action that changed. Vary sentence structure and transitions across findings. Do not begin multiple findings with the same opening phrase, and avoid canned openings such as "The cited frames show" or "The issue is visible."

whyItMatters must be exactly one complete sentence shown as bold white coaching text. whyItMattersDetail must contain two to four normal supporting sentences. Directly explain why this exact visible pattern matters for the declared exercise and its specific consequence to path, range, control, position, balance, tempo, or repeatability. Do not repeat whatHappened and do not use generic wording that could apply to any exercise.

whatToDo must be exactly one complete actionable sentence. This sentence is shown as the bold white coaching line, so it must name the declared exercise or its unmistakable equipment and movement action, give the corrective direction, and state when in the repetition to apply it. successCheck must be one separate sentence shown as normal text that describes what the user should visibly compare on the next set.

Keep each sentence under 18 words. Prefer one direct clause, concrete exercise language, and no repeated setup phrases. Use everyday words a new lifter can understand. Replace technical anatomy or coaching jargon with the body part and visible action the user can see.

Never write milliseconds or raw timing field names in coaching. If time materially helps, express it in readable seconds, such as "around 3.3 seconds." Prefer the supported repetition number and movement phase over a clock value.

overallAssessment must contain three to four sentences. Summarize the complete set, its clearest strength, its main change, and the top priority. coachNote must contain exactly three sentences: what the user did, why the main pattern matters, and the clearest next-set focus.

Write direct, supportive coaching for this exact recorded set. Never write generic advice that could be pasted onto another person's result. Tie each whatToDo and successCheck to that finding's visible body position, path, range, tempo, equipment contact, or beginning-to-end change. Use the declared exercise, load, equipment, side, or set amount when it genuinely makes the instruction more personal. The overallAssessment and coachNote must name concrete details unique to this set.

Keep every observation visual: do not claim muscle activation, recruitment, growth, internal forces, joint stress or protection, strain, injury risk, pain, tissue effects, or medical safety. Explain visible consistency, control, path, range, balance, or stability instead. Keep scores generous but honest: 90-100 is excellent with only tiny refinements; 80-89 is strong; 70-79 is generally good with fixable issues; 60-69 means several clear problems; below 60 is reserved for major or repeated problems. Recognize visible strengths and do not punish camera uncertainty. Return exactly four distinct, exercise-specific scores. Do not return general guidance or view notes.`;

export function buildWholeVideoWritingPrompt(analysis: BoundaryFreeAnalysis, declaration?: SetDeclaration): string {
  const { viewNotes: _viewNotes, ...videoUnderstanding } = analysis.videoUnderstanding;
  const repAudit = videoUnderstanding.repAudit.map(({ startMs, peakMs, endMs, ...rep }) => ({
    ...rep,
    startSeconds: secondsFromMilliseconds(startMs),
    peakSeconds: secondsFromMilliseconds(peakMs),
    endSeconds: secondsFromMilliseconds(endMs),
  }));
  const coachingItems = analysis.coachingItems.map((item) => ({
    ...item,
    observation: humanizeCoachingTimeUnits(item.observation),
    observationDetails: humanizeCoachingTimeUnits(item.observationDetails),
    whyItMatters: humanizeCoachingTimeUnits(item.whyItMatters),
    whyDetails: humanizeCoachingTimeUnits(item.whyDetails),
    correctionDirection: humanizeCoachingTimeUnits(item.correctionDirection),
    evidence: item.evidence.map(({ startMs, peakMs, endMs, ...moment }) => ({
      ...moment,
      visualEvidence: humanizeCoachingTimeUnits(moment.visualEvidence),
      startSeconds: secondsFromMilliseconds(startMs),
      peakSeconds: secondsFromMilliseconds(peakMs),
      endSeconds: secondsFromMilliseconds(endMs),
    })),
  }));
  const immutableAnalysis = {
    declaration: declaredSetSummary(declaration),
    videoUnderstanding: { ...videoUnderstanding, repAudit },
    movementScores: analysis.movementScores,
    coachingItems,
    strengths: analysis.strengths,
  };
  return `Validated analysis:\n${JSON.stringify(immutableAnalysis)}`;
}

export const BOUNDARY_FREE_ANALYSIS_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["videoUnderstanding", "movementScores", "muscleFocus", "coachingItems", "evidenceSelections"],
  properties: {
    videoUnderstanding: { type: "object", additionalProperties: false, required: ["recordingSummary", "exerciseSummary", "visibleSequence", "changesAcrossVideo", "setupEquipmentAndSurroundings", "observedRepCount", "repAudit"], properties: { recordingSummary: { type: "string" }, exerciseSummary: { type: "string" }, visibleSequence: { type: "string" }, changesAcrossVideo: { type: "string" }, setupEquipmentAndSurroundings: { type: "string" }, observedRepCount: { type: "integer", minimum: 1 }, repAudit: { type: "array", minItems: 1, maxItems: 30, items: { type: "object", additionalProperties: false, required: ["repNumber", "startMs", "peakMs", "endMs", "visualSummary"], properties: { repNumber: { type: "integer", minimum: 1 }, startMs: { type: "integer", minimum: 0 }, peakMs: { type: "integer", minimum: 0 }, endMs: { type: "integer", minimum: 0 }, visualSummary: { type: "string" } } } } } },
    movementScores: { type: "array", minItems: 4, maxItems: 4, items: { type: "object", additionalProperties: false, required: ["id", "label", "score", "observed", "evidenceIds"], properties: { id: { type: "string" }, label: { type: "string" }, score: { type: "number", minimum: 0, maximum: 100 }, observed: { type: "string" }, evidenceIds: { type: "array", items: { type: "string" } } } } },
    muscleFocus: { type: "object", additionalProperties: false, required: ["primary", "secondary", "unclassified"], properties: { primary: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "region"], properties: { name: { type: "string" }, region: { type: "string", enum: MUSCLE_REGIONS } } } }, secondary: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "region"], properties: { name: { type: "string" }, region: { type: "string", enum: MUSCLE_REGIONS } } } }, unclassified: { type: "array", items: { type: "string" } } } },
     coachingItems: { type: "array", minItems: 4, items: { type: "object", additionalProperties: false, required: ["id", "topic", "observation", "observationDetails", "whyItMatters", "whyDetails", "correctionDirection", "affectedRepNumbers", "severity", "confidence"], properties: { id: { type: "string" }, topic: { type: "string" }, observation: { type: "string" }, observationDetails: { type: "string" }, whyItMatters: { type: "string" }, whyDetails: { type: "string" }, correctionDirection: { type: "string" }, affectedRepNumbers: { type: "array", minItems: 1, uniqueItems: true, items: { type: "integer", minimum: 1 } }, severity: { type: "string", enum: ["high", "important", "note"] }, confidence: { type: "number", minimum: 0, maximum: 1 } } } },
    evidenceSelections: { type: "array", items: { type: "object", additionalProperties: false, required: ["findingId", "moments"], properties: { findingId: { type: "string" }, primaryEvidenceIndex: { type: "integer", minimum: 0 }, moments: { type: "array", minItems: 1, items: evidenceSchema } } } },
  },
} as const;

function declaredSetSummary(declaration?: SetDeclaration): string {
  if (!declaration) return "No set declaration was provided.";
  const amount = declaration.amount.kind === "reps" ? `${declaration.amount.value} ${declaration.amount.countScope === "per_side" ? "reps per side" : "total reps"}` : `${declaration.amount.value} seconds`;
  const load = declaration.load.kind === "known" ? `${declaration.load.value} ${declaration.load.unit} ${declaration.load.scope.replaceAll("_", " ")}` : declaration.load.kind;
  return `The person declared: ${declaration.exercise.label}, ${amount}, load ${load}${declaration.side ? `, side ${declaration.side}` : ""}${declaration.styles.length > 0 ? `, intentional styles ${declaration.styles.join(", ")}` : ""}${declaration.focusNote ? `, note "${declaration.focusNote}"` : ""}.`;
}

export function buildBoundaryFreeAnalysisPrompt(durationMs: number, declaration?: SetDeclaration): string {
  return `You are Formie's full-video exercise analyst. The recording is ${durationMs} ms long. ${declaredSetSummary(declaration)}

Watch the complete original recording from its first frame through its final frame before drafting findings. The declared exercise is the authoritative coaching context: do not rename or second-guess it. The visible rep count may differ, repetitions may be partial or imperfect, and setup or finishing movement may occupy part of the recording; continue analyzing the usable exercise movement.

This may be a mobile recording whose stored pixel dimensions rely on rotation metadata. Before interpreting movement direction or anatomy, orient the person with gravity, the floor, bench, rack, and other stable scene references. Never analyze a sideways storage orientation as though it were the intended viewing orientation. Calibrate camera perspective using camera height, oblique projection, distance, visible landmarks, support geometry, and occlusion. Foreshortening can change screen appearance without changing the real body relationship, so compare body-relative and equipment-relative landmarks across equivalent phases and lower confidence when depth is hidden.

First identify the continuous active-set interval from the start of the first real repetition through the end of the last real repetition. Setup, walking, camera interaction, picking up or setting down equipment, repositioning, sitting or lying back, and leaving the exercise position are not technique findings. Analyze only exercise movement inside that interval. A transition counts only when it is visibly part of moving between real repetitions and materially affects the next repetition.

Before writing corrections, complete this whole-movement evidence sequence in order:
1. Identify every complete visible repetition from the first real repetition through the final real repetition.
2. Return repAudit with exactly one sequential item for every observed repetition. Each item must bound that complete repetition with startMs < peakMs < endMs and summarize the visible path, endpoints, range, tempo, stability, and control for that specific repetition.
3. Compare the same body, equipment, contact points, and stable references at equivalent phases on every audited repetition, including the first, middle, and final repetitions.
4. Set observedRepCount equal to repAudit.length, then fill visibleSequence and changesAcrossVideo from that complete repetition-by-repetition review.
5. Only after the chronological record is complete, create coaching items, muscle focus, and scores.
Do not let an obvious early issue stop the whole-video review.

Track the segments that drive the repeated movement. Independently compare the visible hand or equipment, wrist, elbow, shoulder, torso, pelvis, knees, feet, support points, and stable scene references when relevant to this exact exercise and camera view. Describe the movement actually visible in the pixels rather than substituting the textbook motion you expected.

Perform a dedicated path-and-endpoint review. Use this universal path decision gate before scoring path or calling path a strength:
1. Establish the intended visible start-to-end landmark relationship for the declared exercise and variation.
2. Record the observed start, travel, reversal, and endpoint at equivalent phases near the beginning, middle, and end.
3. Compare the intended and observed landmark relationships explicitly.
4. When they visibly differ, create a path, range, or endpoint coaching item with its own evidence.
5. Call path a strength only when both repeatability and the visible endpoint relationship match.
A smooth or consistent path can still be a useful correction when its endpoint relationship is visibly mismatched.

Build one complete ranked inventory from every independently visible issue or optimization inside real repetitions. Inspect exercise-specific setup and support, stance, posture, torso and pelvis position, grip and equipment contact, equipment motion, lifting path, lowering path, reversal points, range and endpoints, joint alignment, left-right symmetry, balance, stability, tempo, momentum, control, and repetition-to-repetition consistency. Also inspect any other visible exercise-specific relationship not named here. These are inspection directions, not a fixed output taxonomy.

For each likely item, compare the same visible feature at equivalent phases across every audited repetition. Return affectedRepNumbers as the exact repetition numbers where the issue is visible, and include at least one matching evidence moment for every affected repetition. A planted hand, foot, or knee does not by itself prove the torso stayed steady. If a deviation appears in separated repetitions, include separated evidence moments and describe it as recurring. Never claim a repetition, throughout, consistently, repeatedly, every rep, or across the set without matching evidence for that scope. Do not attribute a problem to fatigue or only the final rep when earlier equivalent phases also show it.

Rest between completed repetitions is not a technique error. Do not create a finding whose main subject is pause duration or between-rep cadence. Report only the visible position, path, range, stability, or control change that occurs during a repetition. Do not turn normal mechanics, clothing motion, camera perspective, occlusion, or pre-set and post-set actions into findings.

Every coaching item must stay semantically aligned: topic, observation, observationDetails, whyItMatters, whyDetails, correctionDirection, affectedRepNumbers, and evidence must all describe the same visible relationship. Do not split one issue into duplicate topics or merge separate visible problems into one. Explain importance only through visible path, range, control, steadiness, position, balance, or repeatability. Never claim hidden muscle activation, involvement, recruitment, effort, or tension; internal forces; joint stress or mobility; work output; pain; injury; tissue effects; or exact joint angles. Do not label knees traveling past the toes, looking up or down, or stopping above parallel as an error by itself. Those relationships are findings only when the recording also shows a specific visible consequence such as heel lift, lost balance, a changed equipment path, an inconsistent endpoint, or a declared range constraint.

Finish the user-facing coaching inside this same whole-video response. For every coaching item, observation must be exactly one complete sentence naming the exact visible issue in this declared exercise. observationDetails must contain three to four normal supporting sentences naming the affected repetitions, phases, and comparison across the audited set. whyItMatters must be exactly one complete sentence describing the direct visible consequence. whyDetails must contain two to four normal supporting sentences tied specifically to visible path, range, control, position, balance, tempo, or repeatability. correctionDirection must be exactly one complete actionable sentence naming what to change and when in the repetition to apply it. Keep each coaching sentence under 18 words, with one direct clause whenever possible. Use specific, common words a new lifter can understand immediately. Name the visible body part or equipment action instead of using technical coaching jargon. Use plain text only with no Markdown, asterisks, headings, bullets, numbered labels, or backticks.

Return four to six distinct evidence-backed coaching issues. Do not stop at four. After ranking the first four, inspect the remaining inventory again and return a fifth or sixth whenever another independent visible relationship is supported. Return only four after explicitly ruling out every other real issue or useful visible optimization. A smaller issue is still useful when it is specific, independent, and evidence-backed. When fewer than four major faults exist, use a small but real visible optimization as severity note; never invent hidden physiology, duplicate another topic, use camera uncertainty, or use actions outside real repetitions. Every issue must carry its own matching evidence and affectedRepNumbers.

Choose evidence only after completing the inventory. peakMs must be the clearest exact frame where the described relationship is visible, not a generic phase marker or the start or end by default. startMs and endMs provide short neighboring context, with startMs < peakMs < endMs. For tempo, control, or set changes, describe what the neighboring frames establish while still selecting the clearest single peak frame. Use repNumber only when the full sequence makes that rep number reliable; otherwise use null and describe beginning, middle, end, or the visible phase. Spread primaryEvidenceIndex choices across different valid repetitions and timepoints. Treat the primary choices as one set-level display sequence, not independent defaults. Reuse a primary peak only when that finding has no other matching evidence moment.

Return muscleFocus for the declared exercise and visible variation. muscleFocus represents normal target anatomy and is separate from the visible coaching issues.

Return exactly four distinct exercise-specific movement scores. Choose categories that match the visible demands of this exercise rather than generic labels. Scores must agree with the final findings, their severity, recurrence, and confidence. Do not lower scores for camera uncertainty, occlusion, or because many minor notes were returned. Use 90-100 for exceptional repeatable execution with only tiny refinements, 80-89 for strong execution with minor opportunities, 70-79 for multiple important recurring problems, 60-69 only for several major repeated breakdowns, and below 60 only for severe persistent breakdowns. Note-level items should have little effect on the score.

This is the only video-analysis pass. Resolve uncertainty through the complete chronological review, lower confidence when needed, and Always set recheckRequest to null. Never request or imply a second watch.

Before returning, verify that four to six real coaching items remain after removing duplicates and unsupported claims, that repAudit contains every observed repetition, and that every affectedRepNumbers value has matching original-video evidence. Perform a final contradiction check across the chronological account, rep count, scores, findings, strengths, muscle focus, and timestamps. Return one complete JSON object matching the schema.`;
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
