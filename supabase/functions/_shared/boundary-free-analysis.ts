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
    whatHappenedDetail: string;
    whyItMatters: string;
    whyItMattersDetail: string;
    whatToDo: string;
    successCheck: string;
  }>;
  strengths: Array<{ id: string; title: string; detail: string }>;
};

const ANATOMY_REGIONS = ["chest", "shoulders", "upper_back", "lats", "upper_arms", "elbows", "forearms", "wrists", "torso", "lower_back", "hips", "glutes", "quads", "hamstrings", "adductors", "knees", "calves", "ankles"] as const satisfies readonly AnatomyRegion[];
const MUSCLE_REGIONS = ["chest", "front_shoulders", "rear_shoulders", "upper_back", "lats", "biceps", "triceps", "forearms", "abs", "obliques", "lower_back", "glutes", "quads", "hamstrings", "adductors", "calves"] as const;
const TOPIC_NORMALIZATION = /[^a-z0-9]+/g;

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
  const unclassified = focus.unclassified === undefined
    ? []
    : stringArray(focus.unclassified, "muscleFocus.unclassified");
  const parseTargets = (raw: unknown, name: "primary" | "secondary", excludedRegions = new Set<string>()) => {
    if (!Array.isArray(raw)) throw new Error(`muscleFocus.${name} must be an array`);
    const regions = new Set<string>();
    return raw.flatMap((entry, index) => {
      const target = record(entry, `muscleFocus.${name}[${index}]`);
      if (!MUSCLE_REGIONS.includes(target.region as typeof MUSCLE_REGIONS[number])) throw new Error(`muscleFocus.${name}[${index}].region is invalid`);
      const targetName = text(target.name, `muscleFocus.${name}[${index}].name`);
      const region = String(target.region);
      if (regions.has(region) || excludedRegions.has(region)) {
        unclassified.push(targetName);
        return [];
      }
      regions.add(region);
      return [{ name: targetName, region: target.region as typeof MUSCLE_REGIONS[number] }];
    });
  };
  const primary = parseTargets(focus.primary, "primary");
  const secondary = parseTargets(focus.secondary, "secondary", new Set(primary.map((target) => target.region)));
  return { primary, secondary, unclassified: [...new Set(unclassified)] };
}

function parseScores(value: unknown, findingIds: Set<string>): MovementScore[] {
  if (!Array.isArray(value)) throw new Error("movementScores must be an array");
  if (value.length !== 4) throw new Error("movementScores must contain exactly four scores");
  const rawScores = value.map((raw, index) => boundedNumber(record(raw, `movementScores[${index}]`).score, `movementScores[${index}].score`, 0, 100));
  // Gemini occasionally answers on a 0-10 scale even though the public score
  // contract is 0-100. If every score is <= 10, normalize the response as one
  // unit instead of displaying values such as 5 or 6 out of 100.
  const scale = rawScores.every((score) => score <= 10) ? 10 : 1;
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
      score: rawScores[index] * scale,
      observed: text(item.observed, `movementScores[${index}].observed`),
      evidenceIds: Array.isArray(item.evidenceIds) ? [...new Set(item.evidenceIds.filter((id): id is string => typeof id === "string" && findingIds.has(id)))] : [],
    };
  });
}

function inferObservedIssueRegions(values: string[]): AnatomyRegion[] {
  const combined = values.join(" ").toLowerCase().replaceAll("_", " ");
  const matches: Array<[RegExp, AnatomyRegion]> = [
    [/\b(?:hand|grip|wrist|knuckle)\b/, "wrists"],
    [/\bforearm\b/, "forearms"],
    [/\belbow\b/, "elbows"],
    [/\b(?:upper arm|bicep|tricep|arm)\b/, "upper_arms"],
    [/\b(?:shoulder|delt)\b/, "shoulders"],
    [/\b(?:upper back|thoracic|scapula|trap)\b/, "upper_back"],
    [/\blat\b/, "lats"],
    [/\b(?:chest|sternum)\b/, "chest"],
    [/\b(?:torso|trunk|core|rib)\b/, "torso"],
    [/\b(?:lower back|lumbar)\b/, "lower_back"],
    [/\b(?:hip|pelvis)\b/, "hips"],
    [/\bglute\b/, "glutes"],
    [/\b(?:quad|thigh)\b/, "quads"],
    [/\bhamstring\b/, "hamstrings"],
    [/\b(?:adductor|inner thigh)\b/, "adductors"],
    [/\bknee\b/, "knees"],
    [/\b(?:calf|calves)\b/, "calves"],
    [/\b(?:ankle|heel|foot|feet)\b/, "ankles"],
  ];
  return [...new Set(matches.filter(([pattern]) => pattern.test(combined)).map(([, region]) => region))];
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
      const observation = humanizeCoachingTimeUnits(text(item.observation, `coachingItems[${index}].observation`));
      ids.add(id);
      topics.add(normalized);
      itemDrafts.push({
        id,
        topic,
        observation,
        observationDetails: humanizeCoachingTimeUnits(text(item.observationDetails, `coachingItems[${index}].observationDetails`)),
        whyItMatters: humanizeCoachingTimeUnits(text(item.whyItMatters, `coachingItems[${index}].whyItMatters`)),
        whyDetails: humanizeCoachingTimeUnits(text(item.whyDetails, `coachingItems[${index}].whyDetails`)),
        correctionDirection: humanizeCoachingTimeUnits(text(item.correctionDirection, `coachingItems[${index}].correctionDirection`)),
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
      observedIssueRegions: item.observedIssueRegions.length > 0
        ? item.observedIssueRegions
        : inferObservedIssueRegions([
          item.topic,
          item.observation,
          item.observationDetails,
          ...evidence.flatMap((moment) => [moment.visualEvidence, ...moment.visibleBodyAreas]),
        ]),
      affectedRepNumbers: evidenceReps.size === 0
        ? item.affectedRepNumbers
        : supportedRepNumbers.length > 0 ? supportedRepNumbers : [...evidenceReps],
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

export const WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION = `You are Formie's coaching writer. Write clear, natural coaching from the validated analysis and return only JSON matching the schema.

Write the final display copy yourself. Keep the supplied issue and strength IDs and use only facts supported by the analysis. Make every response specific to this exercise, this set, and what is visible in this video. Use precise coaching language that is easy to understand.

For each issue, whatHappened is a short bold-title line and whatHappenedDetail is exactly three sentences explaining what happened in this video. whyItMatters is a short bold-title line and whyItMattersDetail is exactly three sentences explaining why that specific form issue matters for this exercise. whatToDo is one direct sentence telling the person what to do next. Use seconds rather than milliseconds.`;

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
     coachingItems: { type: "array", minItems: 4, items: { type: "object", additionalProperties: false, required: ["id", "topic", "observation", "observationDetails", "whyItMatters", "whyDetails", "correctionDirection", "affectedRepNumbers", "severity", "confidence", "observedIssueRegions"], properties: { id: { type: "string" }, topic: { type: "string" }, observation: { type: "string" }, observationDetails: { type: "string" }, whyItMatters: { type: "string" }, whyDetails: { type: "string" }, correctionDirection: { type: "string" }, affectedRepNumbers: { type: "array", minItems: 1, uniqueItems: true, items: { type: "integer", minimum: 1 } }, severity: { type: "string", enum: ["high", "important", "note"] }, confidence: { type: "number", minimum: 0, maximum: 1 }, observedIssueRegions: { type: "array", items: { type: "string", enum: ANATOMY_REGIONS } } } } },
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

Watch and understand the complete recording once before identifying any issues. Review the beginning, middle, and end so the result represents the entire performed set rather than one convenient moment. Use the declared exercise as the coaching context.

First build the chronological video understanding. Identify the active exercise set, audit every visible repetition in repAudit, set observedRepCount to repAudit.length, and summarize what happens across the full recording. Ignore setup, camera handling, rest between repetitions, and actions after the set when identifying form issues.

Only identify problems with the performed form itself. Do not report ordinary differences between repetitions, sets, or intentional variations as issues. A form problem may occur on only some repetitions, but the issue must be the actual body, equipment, path, range, balance, or control problem—not merely the fact that repetitions differ.

Do not title or describe an issue as inconsistency, variation, or a change between repetitions. Use comparisons only as evidence, then name the actual fault—for example, shallow squat depth on the affected rep rather than inconsistent squat depth. Changing arm position during a bodyweight squat is not itself a form issue. Do not infer a counterbalance benefit or balance fault from arm position alone. Do not report arm position as a second explanation for an already-reported torso or balance fault. Arm position may be reported only when the video directly shows that the chosen position itself causes a separate visible loss of balance, alignment, path, range, or control during the squat.

Recommended checks include hands and grip; equipment and contact points; body position and alignment; setup and support; lifting and lowering path; range and endpoints; tempo and control; balance and stability; joint tracking; and left-right imbalance. These are recommended checks, not required categories. Follow any other exercise-specific form relationship that the video makes relevant.

Return four to six distinct form issues, ordered by usefulness and importance. Use genuine corrections first and smaller evidence-backed form optimizations when needed to reach four. Do not duplicate one problem under multiple labels. Every issue must be specific to the declared exercise and supported by visible evidence from the original recording, with affectedRepNumbers and a matching evidence selection.

Return the analyst facts and recommendations without trying to polish the final display copy. For each issue, return observedIssueRegions using the anatomy regions allowed by the schema so Your Form can highlight the affected area. Pass the resulting evidence-backed issue record to the coaching writer. Also return the exercise-specific muscle focus, genuine strengths, and exactly four movement scores on a 0-to-100 scale that agree with the observed form; never use a 0-to-10 scale.

This is the only video-analysis pass. Resolve the analysis from the complete recording and Always set recheckRequest to null. Return one JSON object matching the schema.`;
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
