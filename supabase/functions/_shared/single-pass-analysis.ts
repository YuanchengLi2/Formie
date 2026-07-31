import type { AnalysisCandidate, AnatomyRegion, CoachingCoverageItem, CoachingFinding, EquipmentObservation, EvidenceMoment, ExerciseFamily, ExerciseGuide, MovementScore, MuscleFocus, MuscleRegion, MuscleTarget } from "./analysis-contract.ts";
import type { SetDeclaration } from "./set-declaration.ts";
import { calibratedTechniqueScore } from "./score-calibration.ts";
import { normalizeEquipmentLoad } from "./equipment-load.ts";

type JsonRecord = Record<string, unknown>;

export type AnalysisFindingDecision = CoachingFinding & { kind: "strength" | "correction" | "cue" };
export type ScoreDimensionAssessment = "strong" | "issue" | "limited";
export type AnalysisScoreRationale = AnalysisCandidate["scoreRationale"][number] & { assessment: ScoreDimensionAssessment };
export type WholeSetCheckpoint = {
  position: "beginning" | "middle" | "end";
  startMs: number;
  endMs: number;
  observation: string;
};
export type WholeSetCoverage = {
  activeSetStartMs: number;
  activeSetEndMs: number;
  checkpoints: [WholeSetCheckpoint, WholeSetCheckpoint, WholeSetCheckpoint];
  changeAcrossSet: string;
};
export type MovementAnalysis = string;

export type AnalysisDecision = Omit<AnalysisCandidate, "scoreRationale" | "movementScores" | "didWell" | "priorityCorrections" | "coachingCues" | "scorecard" | "precisionRequest" | "comparison" | "muscleFocus" | "coachNote"> & {
  scoreRationale: AnalysisScoreRationale[];
  movementScores: MovementScore[];
  findings: AnalysisFindingDecision[];
  wholeSetCoverage: WholeSetCoverage | null;
  movementAnalysis: MovementAnalysis | null;
};

export type WriterCopyPatch = {
  overallAssessment: string;
  muscleFocus: MuscleFocus;
  coachNote: string;
  findings: Array<{
    findingId: string;
    title: string;
    whatHappened: string;
    whyItMatters: string;
    whatToDo: string;
  }>;
};

export type CombinedAnalysisResponse = {
  decision: AnalysisDecision;
  writerCopy: WriterCopyPatch | null;
};

export type FactualContradiction = {
  kind: "observation" | "score" | "coaching" | "rep_count" | "timestamp" | "status";
  findingId: string | null;
  startMs: number | null;
  endMs: number | null;
  description: string;
};

export type WriterAuditResponse = {
  coaching: WriterCopyPatch;
  contradictions: FactualContradiction[];
};

const SCORE_KEYS = ["setup_stability", "path_alignment", "range_positions", "control_tempo", "rep_consistency"];
const EXERCISE_FAMILIES = ["curl", "triceps", "press", "overhead-press", "fly", "raise", "row", "pull-down", "squat", "lunge", "hinge", "hip-thrust", "carry", "core", "plank", "other"];
const EVIDENCE_PHASES = ["setup", "bottom", "concentric", "top", "eccentric", "transition", "whole-set"];
const EQUIPMENT_CATEGORIES = ["visible_load", "setup", "balance", "equipment_motion", "limitation"];
const COACHING_COVERAGE_DOMAINS = ["surroundings", "equipment_setup", "grip_contact", "starting_position", "movement_execution", "support_balance"] as const;
const COACHING_AREAS = ["form", "load", "posture_setup", "equipment", "safety_surroundings", "grip_contact", "support_balance"] as const;
const LOAD_UNITS = ["kg", "lb"];
const LOAD_CERTAINTIES = ["exact_visible", "partial_visible", "unknown"];
const LOAD_BASES = ["readable_label", "readable_selector", "counted_visible_plates", "not_readable"];
const MUSCLE_REGIONS = ["chest", "front_shoulders", "rear_shoulders", "upper_back", "lats", "biceps", "triceps", "forearms", "abs", "obliques", "lower_back", "glutes", "quads", "hamstrings", "adductors", "calves"] as const;
const MUSCLE_NAME_REGIONS: ReadonlyArray<[MuscleRegion, RegExp]> = [
  ["chest", /\b(?:chest|pecs?|pectoralis|pectorals?)\b/i],
  ["rear_shoulders", /\b(?:rear|posterior)\s+(?:delts?|deltoids?|shoulders?)\b/i],
  ["front_shoulders", /\b(?:(?:front|anterior)\s+(?:delts?|deltoids?|shoulders?)|delts?|deltoids?|shoulders?)\b/i],
  ["upper_back", /\b(?:upper back|traps?|trapezius|rhomboids?)\b/i],
  ["lats", /\b(?:lats?|latissimus(?: dorsi)?)\b/i],
  ["biceps", /\b(?:biceps?|brachialis|coracobrachialis)\b/i],
  ["triceps", /\b(?:triceps?|anconeus)\b/i],
  ["forearms", /\b(?:forearms?|brachioradialis|wrist flexors?|wrist extensors?|pronators?|supinators?)\b/i],
  ["obliques", /\b(?:obliques?)\b/i],
  ["abs", /\b(?:abs|abdominals?|rectus abdominis|transversus abdominis)\b/i],
  ["lower_back", /\b(?:lower back|erector spinae|multifidus|quadratus lumborum)\b/i],
  ["glutes", /\b(?:glutes?|gluteus)\b/i],
  ["quads", /\b(?:quads?|quadriceps|rectus femoris|vastus)\b/i],
  ["hamstrings", /\b(?:hamstrings?|biceps femoris|semimembranosus|semitendinosus)\b/i],
  ["adductors", /\b(?:adductors?|inner thighs?|gracilis)\b/i],
  ["calves", /\b(?:calves?|gastrocnemius|soleus)\b/i],
];
const ANATOMY_REGIONS = ["chest", "shoulders", "upper_back", "lats", "upper_arms", "elbows", "forearms", "wrists", "torso", "lower_back", "hips", "glutes", "quads", "hamstrings", "adductors", "knees", "calves", "ankles"] as const;
const MIN_VISIBLE_EVIDENCE_CONFIDENCE = 0.4;
const MIN_CORRECTION_PROBLEMS = 4;
const MIN_ACTIONABLE_COACHING_TOPICS = 2;
const MAX_EVIDENCE_WINDOW_MS = 4_000;
const MAX_EVIDENCE_BOUNDARY_DRIFT_MS = MAX_EVIDENCE_WINDOW_MS;
const EVIDENCE_REP_TOLERANCE_MS = 1_000;
const LEGACY_PUBLIC_EVIDENCE_CONFIDENCE = 0.75;
const LEGACY_PUBLIC_FOCUS_CONFIDENCE = 0.8;
const INTERNAL_STATE_LANGUAGE = /\b(?:activat(?:e|es|ed|ing|ion)|active|brac(?:e|es|ed|ing)|engag(?:e|es|ed|ing|ement)|isolat(?:e|es|ed|ing|ion)|relax(?:es|ed|ing|ation)?|tension|contraction|lengthened muscle|lats?|latissimus|biceps?|triceps?|pecs?|pectorals?|deltoids?|glutes?|hamstrings?|quadriceps?|quads?|calves?|trapezius|traps?|rhomboids?|erectors?|abdominals?|abs|obliques?|muscles?|muscle focus|internal force|load distribution)\b/i;
const UNSUPPORTED_WRITER_STATE = /\b(?:activat(?:e|es|ed|ing|ion)|brac(?:e|es|ed|ing)|engag(?:e|es|ed|ing|ement)|isolat(?:e|es|ed|ing|ion)|relax(?:es|ed|ing|ation)?|contraction|lengthened muscle|muscle focus|internal force|load distribution)\b/i;
const RECURRENCE_LANGUAGE = /\b(?:every (?:repetition|rep)|all (?:repetitions|reps)|multiple (?:repetitions|reps)|several (?:repetitions|reps)|repeatedly|recurr(?:ing|ed|s)?|consistent(?:ly)?|throughout|across (?:all |the )?(?:(?:entire|whole|full) )?(?:set|movement|exercise|repetitions?|reps?)|later (?:repetitions|reps)|final (?:repetitions|reps)|reps?\s+\d+\s+(?:through|to|and|,)\s+\d+)\b/i;
const UNSUPPORTED_COACHING_LANGUAGE = /\b(?:pain|strain|joint loading|load distribution|internal force|compensat(?:e|es|ed|ing|ion)|leverage|stress on|muscle activation|muscle isolation)\b/i;
const TECHNICAL_COACHING_JARGON = /\b(?:biomechan(?:ic|ical|ics)|center of mass|concentric|eccentric|implement|kinematic(?:s)?|kinetic chain|posterior chain|proprioception|sagittal plane|frontal plane|transverse plane|scapul(?:a|ar)|thoracic|lumbar|cervical|trajectory|dorsiflex(?:ion)?|plantar flex(?:ion)?|pronat(?:e|ion)|supinat(?:e|ion)|torque|valgus|varus|lockout|hyperextension|peak extension|peak height|neutral joints?|descent|(?:moves?|rolls?|bends?) into extension|reversal)\b/i;
const MUSCLE_MECHANISM_CLAIM = /\b(?:(?:lats?|latissimus|biceps?|triceps?|pecs?|pectorals?|deltoids?|glutes?|hamstrings?|quadriceps?|quads?|calves?|trapezius|traps?|rhomboids?|erectors?|abdominals?|abs|obliques?|muscles?)\b.{0,40}\b(?:activat(?:e|es|ed|ing|ion)|engag(?:e|es|ed|ing)|isolat(?:e|es|ed|ing|ion)|take(?:s|n|ing)? over)|(?:activat(?:e|es|ed|ing|ion)|engag(?:e|es|ed|ing)|isolat(?:e|es|ed|ing|ion))\b.{0,40}\b(?:lats?|latissimus|biceps?|triceps?|pecs?|pectorals?|deltoids?|glutes?|hamstrings?|quadriceps?|quads?|calves?|trapezius|traps?|rhomboids?|erectors?|abdominals?|abs|obliques?|muscles?)|(?:muscle|lats?|biceps?|triceps?|pecs?|deltoids?|glutes?|hamstrings?|quads?|calves?)\s+tension|tension\s+(?:in|on|through)\s+(?:your|the)?\s*(?:lats?|biceps?|triceps?|pecs?|deltoids?|glutes?|hamstrings?|quads?|calves?))\b/i;
const UNSUPPORTED_VISIBLE_PRINCIPLE = /\b(?:force|protect(?:s|ed|ing)?|optimiz(?:e|es|ed|ing))\b/i;
const NUMERIC_ANGLE_LANGUAGE = /\b(?:(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|forty-five|fifty|sixty|seventy|eighty|ninety|hundred)|\d+(?:\.\d+)?)\s*-?\s*degrees?\b/i;
const DEPTH_OR_RANGE_COMMAND = /\b(?:go|move|sink|squat|lower|descend|drop)\s+(?:a little\s+|slightly\s+|much\s+|more\s+)?(?:lower|deeper)|\b(?:increase|use|add)\s+(?:your\s+)?(?:depth|range)\b/i;
const COMFORT_LANGUAGE = /\b(?:comfortable|comfortably|comfort)\b/i;
const CONTROL_LANGUAGE = /\b(?:control|controlled|steady)\b/i;
const USER_FACING_TEXT_KEYS = new Set([
  "title", "detail", "whyItMatters", "correction", "cue", "instruction", "successCheck", "applyWhen",
  "overallAssessment", "coachNote", "whatHappened", "whatToDo", "observed", "assessment", "observation",
  "changeAcrossSet", "sequenceSummary", "coachingBasis", "note", "visualEvidence", "coachingNote",
  "retryReason", "retryInstruction", "coachingRelevance",
]);

function sentenceCount(value: string): number {
  return value.match(/[^.!?]+[.!?]+(?:["'”’)]*)|[^.!?]+$/g)?.filter((sentence) => sentence.trim()).length ?? 0;
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function groundedWriterText(value: unknown, name: string): string {
  const parsed = (text(value, name) as string).replace(/\bcited\b/gi, "shown");
  const technicalTerm = parsed.match(TECHNICAL_COACHING_JARGON)?.[0];
  if (technicalTerm) {
    throw new Error(
      `${name} contains unsupported technical coaching jargon: ${technicalTerm}`,
    );
  }
  if (
    UNSUPPORTED_COACHING_LANGUAGE.test(parsed)
    || UNSUPPORTED_WRITER_STATE.test(parsed)
    || MUSCLE_MECHANISM_CLAIM.test(parsed)
    || UNSUPPORTED_VISIBLE_PRINCIPLE.test(parsed)
    || NUMERIC_ANGLE_LANGUAGE.test(parsed)
  ) {
    throw new Error(`${name} contains unsupported coaching language`);
  }
  return parsed;
}

function validateCombinedVisibleLanguage(value: unknown, path: string[] = []): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateCombinedVisibleLanguage(item, [...path, String(index)]));
    return;
  }
  if (!value || typeof value !== "object") return;
  Object.entries(value as JsonRecord).forEach(([key, nested]) => {
    const nextPath = [...path, key];
    if (
      typeof nested === "string"
      && USER_FACING_TEXT_KEYS.has(key)
      && !nextPath.includes("muscleFocus")
      && (
        UNSUPPORTED_COACHING_LANGUAGE.test(nested)
        || TECHNICAL_COACHING_JARGON.test(nested)
        || UNSUPPORTED_WRITER_STATE.test(nested)
        || MUSCLE_MECHANISM_CLAIM.test(nested)
        || UNSUPPORTED_VISIBLE_PRINCIPLE.test(nested)
        || NUMERIC_ANGLE_LANGUAGE.test(nested)
      )
    ) {
      throw new Error(`${nextPath.join(".")} contains an unsupported visible-movement claim`);
    }
    validateCombinedVisibleLanguage(nested, nextPath);
  });
}

export function rankCorrections<T extends Pick<CoachingFinding, "severity" | "evidence">>(findings: T[]): T[] {
  const severityRank = { high: 0, important: 1, note: 2 } as const;
  return findings
    .map((finding, index) => ({ finding, index }))
    .sort((left, right) =>
      severityRank[left.finding.severity] - severityRank[right.finding.severity]
      || Number(right.finding.evidence.length > 1) - Number(left.finding.evidence.length > 1)
      || left.index - right.index
    )
    .map(({ finding }) => finding);
}

function claimsRecurrence(value: string): boolean {
  return RECURRENCE_LANGUAGE.test(value);
}

function singleEvidenceDetail(visualEvidence: string): string {
  if (!claimsRecurrence(visualEvidence)) return visualEvidence;
  return visualEvidence
    .replace(RECURRENCE_LANGUAGE, "at the cited moment")
    .replace(/\s+([.,])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function adviceApplicationSentence(phase: string | null | undefined): string {
  switch (phase) {
    case "setup": return "Use it during the setup shown here.";
    case "bottom": return "Use it at the bottom position shown here.";
    case "concentric": return "Use it during the lifting phase shown here.";
    case "top": return "Use it at the top position shown here.";
    case "eccentric": return "Use it during the lowering phase shown here.";
    case "transition": return "Use it during the change of direction shown here.";
    case "whole-set": return "Use it throughout your next set.";
    default: return "Use it at the moment shown here.";
  }
}

function adviceWhatHappened(finding: AnalysisFindingDecision): string {
  const evidenceIndex = finding.primaryEvidenceIndex ?? 0;
  const phase = finding.evidence[evidenceIndex]?.phase ?? finding.evidence[0]?.phase;
  return `This is general advice for your next set, not a mistake observed in this recording. ${adviceApplicationSentence(phase)}`;
}

export function analysisValidationFailureCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/wholeSetCoverage|checkpoint|active-set/i.test(message)) return "ANALYSIS_INVALID_COVERAGE";
  if (/leaves the recording|interval must have positive duration/i.test(message)) return "ANALYSIS_INVALID_EVIDENCE_RANGE";
  if (/primaryEvidenceIndex/i.test(message)) return "ANALYSIS_INVALID_EVIDENCE_PRIMARY";
  if (/requires evidence|visualEvidence/i.test(message)) return "ANALYSIS_INVALID_EVIDENCE_MISSING";
  if (/finding|evidence|focusRegion|visibleBodyAreas/i.test(message)) return "ANALYSIS_INVALID_EVIDENCE";
  if (/score|rationale|criterion/i.test(message)) return "ANALYSIS_INVALID_SCORE";
  if (/repTimeline|repetition/i.test(message)) return "ANALYSIS_INVALID_TIMELINE";
  return "ANALYSIS_INVALID_RESPONSE";
}

function object(value: unknown, name: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as JsonRecord;
}

function exactKeys(value: JsonRecord, allowed: string[], name: string) {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0) throw new Error(`${name} contains unexpected keys: ${unexpected.join(", ")}`);
}

function text(value: unknown, name: string, nullable = false): string | null {
  if (nullable && value === null) return null;
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} must be a non-empty string`);
  return value.trim();
}

function visibleMovementText(value: unknown, name: string, nullable = false): string | null {
  const parsed = text(value, name, nullable);
  if (
    parsed === null
    || !(
      INTERNAL_STATE_LANGUAGE.test(parsed)
      || UNSUPPORTED_COACHING_LANGUAGE.test(parsed)
      || UNSUPPORTED_VISIBLE_PRINCIPLE.test(parsed)
      || NUMERIC_ANGLE_LANGUAGE.test(parsed)
    )
  ) return parsed;
  const normalized = parsed
    .replace(/\bkeep (?:your )?lats? engaged\b/gi, "keep the visible shoulder position steady")
    .replace(/\bstay engaged\b/gi, "keep the visible position steady")
    .replace(/\bkeep (?:your )?([a-z][a-z -]{0,40}?) relaxed\b/gi, "Keep $1 steady")
    .replace(/\bfully relaxes\b/gi, "moves lower")
    .replace(/\brelax(?:es|ed|ing)? downward\b/gi, "moves downward")
    .replace(/\brelax(?:es|ed|ing|ation)?\b/gi, "changes position")
    .replace(/\bactivat(?:e|es|ed|ing|ion)\b/gi, "control")
    .replace(/\bactive\b/gi, "steady")
    .replace(/\bbrac(?:e|es|ed|ing)\b/gi, "steady")
    .replace(/\bengag(?:e|es|ed|ing)\b/gi, "control")
    .replace(/\bengagement\b/gi, "control")
    .replace(/\bisolat(?:e|es|ed|ing|ion)\b/gi, "control")
    .replace(/\btension\b/gi, "position control")
    .replace(/\bpeak contraction\b/gi, "top endpoint")
    .replace(/\bcontraction\b/gi, "top position")
    .replace(/\blengthened muscle\b/gi, "lower position")
    .replace(/\b(?:rigid )?leverage base\b/gi, "stable base")
    .replace(/\b(?:internal )?force transmission\b/gi, "visible path control")
    .replace(/\bdistribut(?:e|es|ed|ing) force\b/gi, "keeps foot contact even")
    .replace(/\bprotect(?:s|ed|ing)? (?:the )?(?:joint|joints|knees?|joint stability)\b/gi, "keeps the visible joint position steady")
    .replace(/\boptimiz(?:e|es|ed|ing)\b/gi, "improves")
    .replace(NUMERIC_ANGLE_LANGUAGE, "a visible bend")
    .replace(/\b(?:muscle focus|internal force|load distribution)\b/gi, "visible movement")
    .replace(/\blats?\b/gi, "visible shoulder position")
    .replace(/\bmuscles?\b/gi, "visible position")
    .replace(/\s+/g, " ")
    .trim();
  return (
    INTERNAL_STATE_LANGUAGE.test(normalized)
    || UNSUPPORTED_COACHING_LANGUAGE.test(normalized)
    || UNSUPPORTED_VISIBLE_PRINCIPLE.test(normalized)
    || NUMERIC_ANGLE_LANGUAGE.test(normalized)
  )
    ? "Use the visible position and path shown at the cited moment."
    : normalized;
}

function number(value: unknown, name: string, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  return value;
}

function integer(value: unknown, name: string, minimum: number, maximum: number): number {
  const parsed = number(value, name, minimum, maximum);
  if (!Number.isInteger(parsed)) throw new Error(`${name} must be an integer`);
  return parsed;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function unboundedInteger(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) throw new Error(`${name} must be an integer`);
  return value;
}

function stringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  return value.map((item, index) => text(item, `${name}[${index}]`) as string);
}

function canonicalMuscleRegion(name: string): MuscleRegion | null {
  return MUSCLE_NAME_REGIONS.find(([, pattern]) => pattern.test(name))?.[0] ?? null;
}

function parseMuscleTargets(value: unknown, name: string): { targets: MuscleTarget[]; unclassified: string[] } {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  const targets: MuscleTarget[] = [];
  const unclassified: string[] = [];
  value.forEach((item, index) => {
    const target = object(item, `${name}[${index}]`);
    exactKeys(target, ["name", "region"], `${name}[${index}]`);
    if (!MUSCLE_REGIONS.includes(target.region as MuscleRegion)) {
      throw new Error(`${name}[${index}].region must be a supported body region`);
    }
    const muscleName = text(target.name, `${name}[${index}].name`) as string;
    const region = canonicalMuscleRegion(muscleName);
    if (region === null) {
      unclassified.push(muscleName);
      return;
    }
    targets.push({ name: muscleName, region });
  });
  return { targets, unclassified };
}

function parseMuscleFocus(value: unknown): MuscleFocus {
  const focus = object(value, "writer copy muscleFocus");
  exactKeys(focus, ["primary", "secondary", "unclassified"], "writer copy muscleFocus");
  const uniqueByRegion = (targets: MuscleTarget[]) => targets.filter(
    (target, index) => targets.findIndex((candidate) => candidate.region === target.region) === index,
  );
  const parsedPrimary = parseMuscleTargets(focus.primary, "writer copy muscleFocus.primary");
  const parsedSecondary = parseMuscleTargets(focus.secondary, "writer copy muscleFocus.secondary");
  const primary = uniqueByRegion(parsedPrimary.targets);
  const primaryRegions = new Set(primary.map((target) => target.region));
  const secondary = uniqueByRegion(parsedSecondary.targets)
    .filter((target) => !primaryRegions.has(target.region));
  if (primary.length === 0 || primary.length + secondary.length > 8) {
    throw new Error("writer copy muscleFocus must contain one to eight exercise targets");
  }
  const suppliedUnclassified = focus.unclassified === undefined
    ? []
    : stringArray(focus.unclassified, "writer copy muscleFocus.unclassified");
  const unclassified = [...new Set([...suppliedUnclassified, ...parsedPrimary.unclassified, ...parsedSecondary.unclassified])].slice(0, 8);
  return { primary, secondary, unclassified };
}

function parseFocusRegion(value: unknown, name: string) {
  if (value === null || value === undefined) return null;
  const focus = object(value, name);
  exactKeys(focus, ["centerX", "centerY", "radius", "arrowFromX", "arrowFromY", "label", "confidence"], name);
  try {
    return {
      centerX: number(focus.centerX, `${name}.centerX`, 0, 1),
      centerY: number(focus.centerY, `${name}.centerY`, 0, 1),
      radius: number(focus.radius, `${name}.radius`, 0.06, 0.3),
      arrowFromX: number(focus.arrowFromX, `${name}.arrowFromX`, 0, 1),
      arrowFromY: number(focus.arrowFromY, `${name}.arrowFromY`, 0, 1),
      label: text(focus.label, `${name}.label`) as string,
      confidence: number(focus.confidence, `${name}.confidence`, MIN_VISIBLE_EVIDENCE_CONFIDENCE, 1),
    };
  } catch {
    return null;
  }
}

function parseEvidence(value: unknown, durationMs: number, name: string): EvidenceMoment {
  const evidence = object(value, name);
  exactKeys(evidence, ["startMs", "peakMs", "endMs", "repNumber", "phase", "visualEvidence", "coachingNote", "visibleBodyAreas", "confidence", "focusRegion"], name);
  if (durationMs < 2) throw new Error("recording must be at least two milliseconds long");
  const rawStartMs = unboundedInteger(evidence.startMs, `${name}.startMs`);
  const rawPeakMs = unboundedInteger(evidence.peakMs, `${name}.peakMs`);
  const rawEndMs = unboundedInteger(evidence.endMs, `${name}.endMs`);
  if (rawStartMs >= rawEndMs) throw new Error(`${name} interval must have positive duration`);
  const minimumAllowedMs = -MAX_EVIDENCE_BOUNDARY_DRIFT_MS;
  const maximumAllowedMs = durationMs + MAX_EVIDENCE_BOUNDARY_DRIFT_MS;
  if ([rawStartMs, rawPeakMs, rawEndMs].some((timestamp) => timestamp < minimumAllowedMs || timestamp > maximumAllowedMs)) {
    throw new Error(`${name} leaves the recording by more than ${MAX_EVIDENCE_BOUNDARY_DRIFT_MS} ms`);
  }

  const normalizedRawPeakMs = clamp(rawPeakMs, rawStartMs + 1, rawEndMs - 1);
  const beforePeakMs = normalizedRawPeakMs - rawStartMs;
  const afterPeakMs = rawEndMs - normalizedRawPeakMs;
  const peakMs = Math.max(1, Math.min(durationMs - 1, normalizedRawPeakMs));
  let startMs = rawStartMs < peakMs
    ? Math.max(0, rawStartMs)
    : Math.max(0, peakMs - beforePeakMs);
  let endMs = rawEndMs > peakMs
    ? Math.min(durationMs, rawEndMs)
    : Math.min(durationMs, peakMs + afterPeakMs);
  if (startMs >= peakMs) startMs = peakMs - 1;
  if (endMs <= peakMs) endMs = peakMs + 1;
  if (endMs - startMs > MAX_EVIDENCE_WINDOW_MS) {
    startMs = Math.max(startMs, peakMs - MAX_EVIDENCE_WINDOW_MS / 2);
    endMs = Math.min(endMs, peakMs + MAX_EVIDENCE_WINDOW_MS / 2);
  }
  const repNumber = evidence.repNumber === null || evidence.repNumber === undefined
    ? null
    : integer(evidence.repNumber, `${name}.repNumber`, 1, 10_000);
  const visibleBodyAreas = Array.isArray(evidence.visibleBodyAreas)
    ? evidence.visibleBodyAreas.flatMap((area) => typeof area === "string" && area.trim() ? [area.trim()] : [])
    : [];
  if (visibleBodyAreas.length === 0) visibleBodyAreas.push("visible movement");
  const suppliedPhase = typeof evidence.phase === "string" && evidence.phase.trim() ? evidence.phase.trim() : null;
  const phase = suppliedPhase !== null && EVIDENCE_PHASES.includes(suppliedPhase) ? suppliedPhase : null;
  const confidence = typeof evidence.confidence === "number" && Number.isFinite(evidence.confidence)
    ? clamp(evidence.confidence, MIN_VISIBLE_EVIDENCE_CONFIDENCE, 1)
    : MIN_VISIBLE_EVIDENCE_CONFIDENCE;
  return {
    startMs,
    peakMs,
    endMs,
    repNumber,
    phase,
    visualEvidence: visibleMovementText(evidence.visualEvidence, `${name}.visualEvidence`) as string,
    coachingNote: visibleMovementText(evidence.coachingNote, `${name}.coachingNote`) as string,
    visibleBodyAreas,
    confidence,
    focusRegion: parseFocusRegion(evidence.focusRegion, `${name}.focusRegion`),
  };
}

function parseEquipmentObservation(value: unknown, durationMs: number, index: number): EquipmentObservation {
  const name = `equipmentObservations[${index}]`;
  const observation = object(value, name);
  exactKeys(observation, ["id", "category", "title", "observation", "coachingRelevance", "load", "evidence"], name);
  if (!EQUIPMENT_CATEGORIES.includes(String(observation.category))) throw new Error(`${name}.category is invalid`);
  if (!Array.isArray(observation.evidence) || observation.evidence.length === 0) throw new Error(`${name} requires evidence`);
  const evidence = observation.evidence.map((value, evidenceIndex) => {
    const evidenceName = `${name}.evidence[${evidenceIndex}]`;
    const moment = object(value, evidenceName);
    exactKeys(moment, ["startMs", "peakMs", "endMs", "visualEvidence", "visibleReferences", "confidence", "focusRegion"], evidenceName);
    const rawStartMs = unboundedInteger(moment.startMs, `${evidenceName}.startMs`);
    const rawPeakMs = unboundedInteger(moment.peakMs, `${evidenceName}.peakMs`);
    const rawEndMs = unboundedInteger(moment.endMs, `${evidenceName}.endMs`);
    if (rawStartMs >= rawEndMs) throw new Error(`${evidenceName} interval must have positive duration`);
    const peakMs = clamp(rawPeakMs, 1, durationMs - 1);
    let startMs = clamp(rawStartMs, 0, peakMs - 1);
    let endMs = clamp(rawEndMs, peakMs + 1, durationMs);
    if (endMs - startMs > MAX_EVIDENCE_WINDOW_MS) {
      startMs = Math.max(startMs, peakMs - MAX_EVIDENCE_WINDOW_MS / 2);
      endMs = Math.min(endMs, peakMs + MAX_EVIDENCE_WINDOW_MS / 2);
    }
    return {
      startMs,
      peakMs,
      endMs,
      visualEvidence: visibleMovementText(moment.visualEvidence, `${evidenceName}.visualEvidence`) as string,
      visibleReferences: stringArray(moment.visibleReferences, `${evidenceName}.visibleReferences`),
      confidence: number(moment.confidence, `${evidenceName}.confidence`, MIN_VISIBLE_EVIDENCE_CONFIDENCE, 1),
      focusRegion: parseFocusRegion(moment.focusRegion, `${evidenceName}.focusRegion`),
    };
  });
  const title = visibleMovementText(observation.title, `${name}.title`) as string;
  const observationText = visibleMovementText(observation.observation, `${name}.observation`) as string;
  let load: EquipmentObservation["load"] = null;
  if (observation.load !== null) {
    const rawLoad = object(observation.load, `${name}.load`);
    exactKeys(rawLoad, ["value", "unit", "scope", "certainty", "basis"], `${name}.load`);
    if (!LOAD_CERTAINTIES.includes(String(rawLoad.certainty)) || !LOAD_BASES.includes(String(rawLoad.basis))) throw new Error(`${name}.load certainty or basis is invalid`);
    if (rawLoad.unit !== null && !LOAD_UNITS.includes(String(rawLoad.unit))) throw new Error(`${name}.load.unit is invalid`);
    if (rawLoad.value !== null) number(rawLoad.value, `${name}.load.value`, 0, 100_000);
    if (rawLoad.scope !== null) text(rawLoad.scope, `${name}.load.scope`, true);
    load = normalizeEquipmentLoad(rawLoad, {
      category: observation.category,
      title,
      observation: observationText,
    });
  }
  return {
    id: text(observation.id, `${name}.id`) as string,
    category: observation.category as EquipmentObservation["category"],
    title,
    observation: observationText,
    coachingRelevance: visibleMovementText(observation.coachingRelevance, `${name}.coachingRelevance`, true),
    load,
    evidence,
  };
}

function parseActionableCorrection(value: unknown, name: string) {
  if (value === null) return null;
  const action = object(value, name);
  exactKeys(action, ["instruction", "cue", "successCheck", "applyWhen"], name);
  return {
    instruction: visibleMovementText(action.instruction, `${name}.instruction`) as string,
    cue: visibleMovementText(action.cue, `${name}.cue`) as string,
    successCheck: visibleMovementText(action.successCheck, `${name}.successCheck`, true),
    applyWhen: visibleMovementText(action.applyWhen, `${name}.applyWhen`) as string,
  };
}

function parseWholeSetCoverage(value: unknown, durationMs: number, analyzed: boolean): WholeSetCoverage | null {
  if (!analyzed) {
    if (value !== null) throw new Error("Unable results require wholeSetCoverage to be null");
    return null;
  }
  const coverage = object(value, "wholeSetCoverage");
  exactKeys(coverage, ["activeSetStartMs", "activeSetEndMs", "checkpoints", "changeAcrossSet"], "wholeSetCoverage");
  const activeSetStartMs = integer(coverage.activeSetStartMs, "wholeSetCoverage.activeSetStartMs", 0, Math.max(0, durationMs - 1));
  const activeSetEndMs = integer(coverage.activeSetEndMs, "wholeSetCoverage.activeSetEndMs", 1, durationMs);
  if (activeSetStartMs >= activeSetEndMs) throw new Error("wholeSetCoverage active-set interval must have positive duration");
  if (!Array.isArray(coverage.checkpoints) || coverage.checkpoints.length !== 3) {
    throw new Error("wholeSetCoverage requires exactly three checkpoints");
  }
  const expectedPositions = ["beginning", "middle", "end"] as const;
  const rawCheckpoints = coverage.checkpoints.map((value, index) => {
    const name = `wholeSetCoverage.checkpoints[${index}]`;
    const checkpoint = object(value, name);
    exactKeys(checkpoint, ["position", "startMs", "endMs", "observation"], name);
    const startMs = clamp(unboundedInteger(checkpoint.startMs, `${name}.startMs`), activeSetStartMs, activeSetEndMs - 1);
    const endMs = clamp(unboundedInteger(checkpoint.endMs, `${name}.endMs`), activeSetStartMs + 1, activeSetEndMs);
    return {
      startMs,
      endMs,
      observation: text(checkpoint.observation, `${name}.observation`) as string,
    };
  }).sort((left, right) => ((left.startMs + left.endMs) / 2) - ((right.startMs + right.endMs) / 2));
  const activeDuration = activeSetEndMs - activeSetStartMs;
  const targetCenters = [0.2, 0.5, 0.8];
  const checkpoints = rawCheckpoints.map((checkpoint, index) => {
    const previousEnd = index === 0 ? activeSetStartMs - 1 : rawCheckpoints[index - 1].endMs;
    let startMs = Math.max(checkpoint.startMs, previousEnd + 1);
    let endMs = checkpoint.endMs;
    if (startMs >= endMs) {
      const center = activeSetStartMs + Math.round(activeDuration * targetCenters[index]);
      const halfWindow = Math.max(1, Math.min(Math.floor(activeDuration / 10), 1_500));
      startMs = clamp(center - halfWindow, activeSetStartMs, activeSetEndMs - 1);
      endMs = clamp(center + halfWindow, startMs + 1, activeSetEndMs);
    }
    rawCheckpoints[index] = { ...checkpoint, startMs, endMs };
    return { position: expectedPositions[index], startMs, endMs, observation: checkpoint.observation };
  }) as WholeSetCoverage["checkpoints"];
  const centers = checkpoints.map((checkpoint) => (checkpoint.startMs + checkpoint.endMs) / 2);
  if (!(centers[0] < centers[1] && centers[1] < centers[2])) {
    throw new Error("wholeSetCoverage checkpoints must be ordered and distinct");
  }
  const relativeCenters = centers.map((center) => (center - activeSetStartMs) / activeDuration);
  if (relativeCenters[0] > 0.4 || relativeCenters[1] < 0.25 || relativeCenters[1] > 0.75 || relativeCenters[2] < 0.6) {
    return {
      activeSetStartMs,
      activeSetEndMs,
      checkpoints: checkpoints.map((checkpoint, index) => {
        const center = activeSetStartMs + Math.round(activeDuration * targetCenters[index]);
        const halfWindow = Math.max(1, Math.min(Math.floor(activeDuration / 10), 1_500));
        const startMs = clamp(center - halfWindow, activeSetStartMs, activeSetEndMs - 1);
        const endMs = clamp(center + halfWindow, startMs + 1, activeSetEndMs);
        return { ...checkpoint, startMs, endMs };
      }) as WholeSetCoverage["checkpoints"],
      changeAcrossSet: text(coverage.changeAcrossSet, "wholeSetCoverage.changeAcrossSet") as string,
    };
  }
  return {
    activeSetStartMs,
    activeSetEndMs,
    checkpoints,
    changeAcrossSet: text(coverage.changeAcrossSet, "wholeSetCoverage.changeAcrossSet") as string,
  };
}

function parseMovementAnalysis(value: unknown, analyzed: boolean): MovementAnalysis | null {
  if (!analyzed) {
    if (value !== null) throw new Error("Unable results require movementAnalysis to be null");
    return null;
  }
  return text(value, "movementAnalysis") as string;
}

function parseRecognition(value: unknown): AnalysisDecision["recognition"] {
  const recognition = object(value, "recognition");
  exactKeys(recognition, ["label", "variation", "equipment", "confidence", "alternatives", "exerciseFamily", "catalogExerciseId", "source"], "recognition");
  if (!EXERCISE_FAMILIES.includes(String(recognition.exerciseFamily))) throw new Error("recognition.exerciseFamily is invalid");
  const rawLabel = text(recognition.label, "recognition.label", true);
  const label = rawLabel && /^(?:lying\s+)?(?:barbell|ez[- ]?bar)?\s*triceps?\s+extensions?$/i.test(rawLabel)
    ? "Skull Crushers"
    : rawLabel;
  return {
    label,
    variation: text(recognition.variation, "recognition.variation", true),
    equipment: stringArray(recognition.equipment, "recognition.equipment"),
    confidence: number(recognition.confidence, "recognition.confidence", 0, 1),
    alternatives: stringArray(recognition.alternatives, "recognition.alternatives"),
    catalogExerciseId: null,
    exerciseFamily: recognition.exerciseFamily as ExerciseFamily,
  };
}

function parseVideoCheck(value: unknown): AnalysisDecision["videoCheck"] {
  const videoCheck = object(value, "videoCheck");
  exactKeys(videoCheck, ["outcome", "usableObservations", "limitations", "retryReason", "retryInstruction", "movementPresence"], "videoCheck");
  if (!["usable", "partial", "unable"].includes(String(videoCheck.outcome))) throw new Error("videoCheck.outcome is invalid");
  return {
    outcome: videoCheck.outcome as AnalysisDecision["videoCheck"]["outcome"],
    usableObservations: stringArray(videoCheck.usableObservations, "videoCheck.usableObservations"),
    limitations: stringArray(videoCheck.limitations, "videoCheck.limitations"),
    retryReason: text(videoCheck.retryReason, "videoCheck.retryReason", true),
    retryInstruction: text(videoCheck.retryInstruction, "videoCheck.retryInstruction", true),
  };
}

function parseFinding(value: unknown, durationMs: number, index: number): AnalysisFindingDecision {
  const name = `findings[${index}]`;
  const finding = object(value, name);
  exactKeys(finding, ["id", "kind", "coachingArea", "title", "detail", "whyItMatters", "correction", "cue", "actionableCorrection", "severity", "evidence", "primaryEvidenceIndex", "observedIssueRegions"], name);
  if (!["strength", "correction", "cue"].includes(String(finding.kind))) throw new Error(`${name}.kind is invalid`);
  const coachingArea = finding.coachingArea ?? "form";
  if (!COACHING_AREAS.includes(coachingArea as typeof COACHING_AREAS[number])) throw new Error(`${name}.coachingArea is invalid`);
  if (!["note", "important", "high"].includes(String(finding.severity))) throw new Error(`${name}.severity is invalid`);
  if (!Array.isArray(finding.evidence) || finding.evidence.length === 0) throw new Error(`${name} requires evidence`);
  let firstEvidenceError: unknown = null;
  const parsedEvidence = finding.evidence.flatMap((moment, evidenceIndex) => {
    try {
      return [parseEvidence(moment, durationMs, `${name}.evidence[${evidenceIndex}]`)];
    } catch (error) {
      firstEvidenceError ??= error;
      return [];
    }
  });
  if (parsedEvidence.length === 0) throw firstEvidenceError;
  const primaryEvidenceIndex = finding.primaryEvidenceIndex === undefined
    ? 0
    : integer(finding.primaryEvidenceIndex, `${name}.primaryEvidenceIndex`, 0, parsedEvidence.length - 1);
  const actionableCorrection = parseActionableCorrection(finding.actionableCorrection, `${name}.actionableCorrection`);
  if ((finding.kind === "correction" || finding.kind === "cue") && actionableCorrection === null) {
    throw new Error(`${name} action-oriented coaching topic requires actionable coaching`);
  }
  let detail = visibleMovementText(finding.detail, `${name}.detail`) as string;
  if (claimsRecurrence(detail) && parsedEvidence.length < 2) {
    detail = singleEvidenceDetail(parsedEvidence[0].visualEvidence);
  }
  const recurrenceClaim = claimsRecurrence(detail);
  const severity = finding.kind === "correction"
    && finding.severity === "note"
    && (parsedEvidence.length > 1 || recurrenceClaim)
    ? "important"
    : finding.severity as CoachingFinding["severity"];
  const observedIssueRegions = (Array.isArray(finding.observedIssueRegions) ? finding.observedIssueRegions : [])
    .filter((region): region is AnatomyRegion => ANATOMY_REGIONS.includes(region as AnatomyRegion))
    .filter((region, regionIndex, regions) => regions.indexOf(region) === regionIndex);
  return {
    id: text(finding.id, `${name}.id`) as string,
    kind: finding.kind as AnalysisFindingDecision["kind"],
    coachingArea: coachingArea as CoachingFinding["coachingArea"],
    title: visibleMovementText(finding.title, `${name}.title`) as string,
    detail,
    whyItMatters: visibleMovementText(finding.whyItMatters, `${name}.whyItMatters`) as string,
    correction: visibleMovementText(finding.correction, `${name}.correction`, true),
    cue: visibleMovementText(finding.cue, `${name}.cue`, true),
    actionableCorrection,
    severity,
    evidence: parsedEvidence,
    observedIssueRegions,
    ...(finding.primaryEvidenceIndex === undefined ? {} : { primaryEvidenceIndex }),
  };
}

function normalizeAnalysisDecisionInput(value: unknown, durationMs: number): JsonRecord {
  const result = object(value, "analysis decision");
  const usesSplitCorrectionInventory = "formCorrections" in result || "additionalCorrections" in result;
  const usesModelInventory = usesSplitCorrectionInventory || "corrections" in result || "strengths" in result || "cues" in result;
  if (!usesModelInventory) return result;

  exactKeys(result, ["status", "recognition", "videoCheck", "wholeSetCoverage", "movementAnalysis", "overallAssessment", "score", "scoreRationale", "movementScores", "formCorrections", "additionalCorrections", "corrections", "strengths", "cues", "findings", "equipmentObservations", "exerciseGuide", "coachingCoverage", "setContext", "setSummary", "repTimeline", "nextSetPlan"], "analysis decision");
  if (!["complete", "partial", "unable"].includes(String(result.status))) throw new Error("analysis status is invalid");
  const strengths = Array.isArray(result.strengths) ? result.strengths : [];
  const cues = Array.isArray(result.cues) ? result.cues : [];

  const analyzed = result.status !== "unable";
  if (usesSplitCorrectionInventory && "corrections" in result) {
    throw new Error("Do not mix corrections with the legacy split correction inventory");
  }
  const formCorrections = usesSplitCorrectionInventory
    ? (Array.isArray(result.formCorrections) ? result.formCorrections : [])
    : (Array.isArray(result.corrections) ? result.corrections : []);
  const additionalCorrections = usesSplitCorrectionInventory && Array.isArray(result.additionalCorrections)
    ? result.additionalCorrections
    : [];
  const corrections = [...formCorrections, ...additionalCorrections];
  if (!analyzed && (corrections.length > 0 || strengths.length > 0 || cues.length > 0)) throw new Error("Unable model responses cannot contain findings");
  if (usesSplitCorrectionInventory) {
    const ids = new Set<string>();
    const titles = new Set<string>();
    [...formCorrections, ...additionalCorrections].forEach((item, index) => {
      const finding = object(item, `correction inventory[${index}]`);
      const id = String(finding.id ?? "").trim().toLowerCase();
      const title = String(finding.title ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
      if (ids.has(id) || titles.has(title)) throw new Error("One issue cannot appear in both correction groups");
      ids.add(id);
      titles.add(title);
    });
    additionalCorrections.forEach((item, index) => {
      const finding = object(item, `additionalCorrections[${index}]`);
      if (!COACHING_AREAS.includes(finding.coachingArea as typeof COACHING_AREAS[number]) || finding.coachingArea === "form") {
        throw new Error(`additionalCorrections[${index}].coachingArea must be a supplemental coaching area`);
      }
    });
  }
  const inventories: Array<[unknown[], AnalysisFindingDecision["kind"], string]> = [
    [formCorrections, "correction", usesSplitCorrectionInventory ? "formCorrections" : "corrections"],
    [additionalCorrections, "correction", "additionalCorrections"],
    [strengths, "strength", "strengths"],
    [cues, "cue", "cues"],
  ];
  const normalizedFindings = inventories.flatMap(([items, expectedKind, name]) => items.map((item, index) => {
    const supplied = object(item, `${name}[${index}]`);
    const coachingArea = name === "formCorrections"
      ? "form"
      : supplied.coachingArea ?? "form";
    const correction = supplied.correction ?? null;
    const cue = supplied.cue ?? null;
    const instruction = typeof correction === "string" && correction.trim()
      ? correction
      : typeof cue === "string" && cue.trim()
        ? cue
        : null;
    const actionableCorrection = supplied.actionableCorrection !== undefined
      ? supplied.actionableCorrection
      : expectedKind === "strength" || instruction === null
        ? null
        : {
          instruction,
          cue: instruction,
          successCheck: null,
          applyWhen: coachingArea === "form" ? "During the next set." : "Before the next set.",
        };
    return {
      ...supplied,
      kind: expectedKind,
      coachingArea,
      whyItMatters: supplied.whyItMatters ?? supplied.detail,
      correction,
      cue,
      actionableCorrection,
      observedIssueRegions: supplied.observedIssueRegions ?? [],
    };
  }));

  const {
    formCorrections: _formCorrections,
    additionalCorrections: _additionalCorrections,
    corrections: _corrections,
    strengths: _strengths,
    cues: _cues,
    findings: _legacyFindings,
    ...persisted
  } = result;
  return { ...persisted, findings: normalizedFindings };
}

function parseExerciseGuide(value: unknown, analyzed: boolean, correctionIds: Set<string>): ExerciseGuide | null {
  if (!analyzed || value === undefined || value === null) return null;
  const guide = object(value, "exerciseGuide");
  exactKeys(guide, ["setupSteps", "executionSteps", "relatedFindingIds"], "exerciseGuide");
  const parseSteps = (input: unknown, name: string) => {
    if (!Array.isArray(input) || input.length < 1 || input.length > 5) throw new Error(`${name} must contain one to five steps`);
    return input.map((step, index) => visibleMovementText(step, `${name}[${index}]`) as string);
  };
  return {
    setupSteps: parseSteps(guide.setupSteps, "exerciseGuide.setupSteps"),
    executionSteps: parseSteps(guide.executionSteps, "exerciseGuide.executionSteps"),
    relatedFindingIds: stringArray(guide.relatedFindingIds, "exerciseGuide.relatedFindingIds").filter((id) => correctionIds.has(id)),
  };
}

function parseCoachingCoverage(value: unknown, correctionIds: Set<string>): CoachingCoverageItem[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length !== COACHING_COVERAGE_DOMAINS.length) {
    throw new Error("coachingCoverage must contain all six coaching domains");
  }
  return value.map((entry, index) => {
    const item = object(entry, `coachingCoverage[${index}]`);
    exactKeys(item, ["domain", "status", "observation", "findingIds"], `coachingCoverage[${index}]`);
    const domain = COACHING_COVERAGE_DOMAINS[index];
    if (item.domain !== domain) throw new Error(`coachingCoverage[${index}].domain must be ${domain}`);
    if (!["issue", "clear", "not_visible"].includes(String(item.status))) throw new Error(`coachingCoverage[${index}].status is invalid`);
    const status = item.status as CoachingCoverageItem["status"];
    const findingIds = stringArray(item.findingIds, `coachingCoverage[${index}].findingIds`);
    if (status === "issue" && (findingIds.length === 0 || findingIds.some((id) => !correctionIds.has(id)))) {
      throw new Error(`coachingCoverage[${index}] issue must reference a correction`);
    }
    if (status !== "issue" && findingIds.length > 0) throw new Error(`coachingCoverage[${index}] non-issue cannot reference corrections`);
    return {
      domain,
      status,
      observation: visibleMovementText(item.observation, `coachingCoverage[${index}].observation`) as string,
      findingIds,
    };
  });
}

export function parseAnalysisDecision(value: unknown, durationMs: number, declaration?: SetDeclaration): AnalysisDecision {
  const supplied = value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
  const suppliedUsesModelInventory = Boolean(supplied && ("corrections" in supplied || "formCorrections" in supplied));
  const result = normalizeAnalysisDecisionInput(value, durationMs);
  exactKeys(result, ["status", "recognition", "videoCheck", "wholeSetCoverage", "movementAnalysis", "overallAssessment", "score", "scoreRationale", "movementScores", "findings", "equipmentObservations", "exerciseGuide", "coachingCoverage", "setContext", "setSummary", "repTimeline", "nextSetPlan"], "analysis decision");
  if (!["complete", "partial", "unable"].includes(String(result.status))) throw new Error("analysis status is invalid");
  const analyzed = result.status !== "unable";
  const wholeSetCoverage = parseWholeSetCoverage(result.wholeSetCoverage, durationMs, analyzed);
  const movementAnalysis = parseMovementAnalysis(result.movementAnalysis, analyzed);
  const assertInsideActiveSet = (startMs: number, endMs: number, label: string) => {
    if (!wholeSetCoverage) return;
    if (startMs < wholeSetCoverage.activeSetStartMs || endMs > wholeSetCoverage.activeSetEndMs) {
      throw new Error(`${label} is outside the active-set interval`);
    }
  };

  const parsedRecognition = result.recognition === undefined
    ? {
      label: declaration?.exercise.label ?? "Exercise",
      variation: null,
      equipment: [],
      confidence: declaration ? 1 : 0,
      alternatives: [],
      catalogExerciseId: declaration?.exercise.catalogExerciseId ?? null,
      exerciseFamily: "other" as ExerciseFamily,
      ...(declaration ? { source: "user_declared" as const } : {}),
    }
    : parseRecognition(result.recognition);
  const parsedVideoCheck = parseVideoCheck(result.videoCheck);
  if (declaration && parsedVideoCheck.retryReason?.startsWith("DECLARED_CONTEXT_MISMATCH")) {
    throw new Error(parsedVideoCheck.retryReason);
  }
  if (!Array.isArray(result.findings)) throw new Error("findings must be an array");
  const findingIdCounts = new Map<string, number>();
  let firstFindingError: unknown = null;
  const findings = result.findings.flatMap((finding, index) => {
    try {
      const parsed = parseFinding(finding, durationMs, index);
      const count = findingIdCounts.get(parsed.id) ?? 0;
      findingIdCounts.set(parsed.id, count + 1);
      return [{ ...parsed, id: count === 0 ? parsed.id : `${parsed.id}-${count + 1}` }];
    } catch (error) {
      firstFindingError ??= error;
      return [];
    }
  });
  findings.forEach((finding, findingIndex) => {
    finding.evidence.forEach((evidence, evidenceIndex) => {
      assertInsideActiveSet(
        evidence.startMs,
        evidence.endMs,
        `findings[${findingIndex}].evidence[${evidenceIndex}]`,
      );
    });
  });
  const correctionCount = findings.filter((finding) => finding.kind === "correction").length;
  if (analyzed && suppliedUsesModelInventory && correctionCount < MIN_CORRECTION_PROBLEMS) {
    if (firstFindingError) throw firstFindingError;
    throw new Error("Analyzed model responses require at least four distinct evidence-backed corrections across the visible lift");
  }
  if (analyzed && suppliedUsesModelInventory && findings.filter((finding) => finding.kind === "correction" || finding.kind === "cue").length < MIN_ACTIONABLE_COACHING_TOPICS) {
    if (firstFindingError) throw firstFindingError;
    throw new Error("Analyzed model responses require at least two action-oriented correction or advice topics");
  }
  const equipmentObservations = (Array.isArray(result.equipmentObservations) ? result.equipmentObservations : []).flatMap((observation, index) => {
    try {
      return [parseEquipmentObservation(observation, durationMs, index)];
    } catch {
      return [];
    }
  });
  equipmentObservations.forEach((observation, observationIndex) => {
    observation.evidence.forEach((evidence, evidenceIndex) => {
      assertInsideActiveSet(
        evidence.startMs,
        evidence.endMs,
        `equipmentObservations[${observationIndex}].evidence[${evidenceIndex}]`,
      );
    });
  });
  const findingIds = new Set(findings.map((finding) => finding.id));
  const suppliedRepTimeline = result.repTimeline === undefined ? [] : result.repTimeline;
  if (!Array.isArray(suppliedRepTimeline)) throw new Error("repTimeline must be an array");
  const repCandidates: AnalysisDecision["repTimeline"] = [];
  for (const [index, value] of suppliedRepTimeline.entries()) {
    try {
      const rep = object(value, `repTimeline[${index}]`);
      exactKeys(rep, ["repNumber", "startMs", "peakMs", "endMs", "assessment", "note"], `repTimeline[${index}]`);
      const startMs = clamp(unboundedInteger(rep.startMs, `repTimeline[${index}].startMs`), 0, Math.max(0, durationMs - 1));
      const endMs = clamp(unboundedInteger(rep.endMs, `repTimeline[${index}].endMs`), 1, durationMs);
      const assessment = String(rep.assessment) as AnalysisDecision["repTimeline"][number]["assessment"];
      if (startMs >= endMs || !["strong", "consistent", "breakdown", "uncertain"].includes(assessment)) continue;
      repCandidates.push({
        repNumber: integer(rep.repNumber, `repTimeline[${index}].repNumber`, 1, 10_000),
        startMs,
        peakMs: clamp(unboundedInteger(rep.peakMs, `repTimeline[${index}].peakMs`), startMs, endMs),
        endMs,
        assessment,
        note: text(rep.note, `repTimeline[${index}].note`) as string,
      });
    } catch {
      continue;
    }
  }
  repCandidates.forEach((rep, index) => {
    assertInsideActiveSet(rep.startMs, rep.endMs, `repTimeline[${index}]`);
  });
  repCandidates.sort((left, right) => left.startMs - right.startMs);
  const repTimeline: AnalysisDecision["repTimeline"] = [];
  const usedRepNumbers = new Set<number>();
  repCandidates.forEach((rep) => {
    if (usedRepNumbers.has(rep.repNumber) || (repTimeline.length > 0 && rep.startMs < repTimeline[repTimeline.length - 1].endMs)) return;
    usedRepNumbers.add(rep.repNumber);
    repTimeline.push(rep);
  });
  const reps = new Map(repTimeline.map((rep) => [rep.repNumber, rep]));
  const repIndexes = new Map(repTimeline.map((rep, index) => [rep.repNumber, index]));
  findings.forEach((finding) => finding.evidence.forEach((evidence) => {
    if (evidence.repNumber === null) return;
    const rep = reps.get(evidence.repNumber);
    if (!rep) {
      evidence.repNumber = null;
      return;
    }
    const peakMs = evidence.peakMs ?? evidence.startMs;
    const nearRep = peakMs >= rep.startMs - EVIDENCE_REP_TOLERANCE_MS && peakMs <= rep.endMs + EVIDENCE_REP_TOLERANCE_MS;
    const repIndex = repIndexes.get(rep.repNumber) ?? -1;
    const nextRep = repTimeline[repIndex + 1];
    const betweenAdjacentReps = evidence.phase === "transition" && nextRep !== undefined && peakMs >= rep.endMs && peakMs <= nextRep.startMs;
    if (!nearRep && !betweenAdjacentReps) evidence.repNumber = null;
  }));

  if (!Array.isArray(result.scoreRationale)) throw new Error("scoreRationale must be an array");
  const correctionIds = new Set(findings.filter((finding) => finding.kind === "correction").map((finding) => finding.id));
  const exerciseGuide = parseExerciseGuide(result.exerciseGuide, analyzed, correctionIds);
  const coachingCoverage = parseCoachingCoverage(result.coachingCoverage, correctionIds);
  const rationaleByCriterion = new Map<AnalysisDecision["scoreRationale"][number]["criterion"], AnalysisScoreRationale>();
  result.scoreRationale.forEach((value, index) => {
    try {
      const item = object(value, `scoreRationale[${index}]`);
      exactKeys(item, ["criterion", "assessment", "observed", "impact", "confidence", "evidenceIds"], `scoreRationale[${index}]`);
      if (!SCORE_KEYS.includes(String(item.criterion))) return;
      const criterion = item.criterion as AnalysisDecision["scoreRationale"][number]["criterion"];
      if (rationaleByCriterion.has(criterion)) return;
      const evidenceIds = stringArray(item.evidenceIds, `scoreRationale[${index}].evidenceIds`).filter((id) => findingIds.has(id));
      const requestedAssessment = ["strong", "issue", "limited"].includes(String(item.assessment))
        ? String(item.assessment) as ScoreDimensionAssessment
        : "limited";
      const assessment = requestedAssessment === "issue" && !evidenceIds.some((id) => correctionIds.has(id))
        ? "limited"
        : requestedAssessment;
      rationaleByCriterion.set(criterion, {
        criterion,
        assessment,
        observed: text(item.observed, `scoreRationale[${index}].observed`) as string,
        impact: item.impact === null || typeof item.impact !== "number" ? null : clamp(item.impact, 0, 100),
        confidence: typeof item.confidence === "number" ? clamp(item.confidence, 0, 1) : 0,
        evidenceIds,
      });
    } catch {
      return;
    }
  });
  const scoreRationale = result.status === "unable" ? [] : SCORE_KEYS.map((criterion) => rationaleByCriterion.get(criterion as AnalysisDecision["scoreRationale"][number]["criterion"]) ?? {
    criterion: criterion as AnalysisDecision["scoreRationale"][number]["criterion"],
    assessment: "limited" as const,
    observed: "This scoring dimension could not be established independently from the recording.",
    impact: null,
    confidence: 0,
    evidenceIds: [],
  });
  const suppliedMovementScores = result.movementScores === undefined ? [] : result.movementScores;
  if (!Array.isArray(suppliedMovementScores)) throw new Error("movementScores must be an array");
  if (analyzed && (suppliedMovementScores.length < 3 || suppliedMovementScores.length > 5)) {
    throw new Error("movementScores must contain three to five exercise-specific scores");
  }
  if (!analyzed && suppliedMovementScores.length > 0) {
    throw new Error("Unable responses cannot contain movementScores");
  }
  const movementScoreIds = new Set<string>();
  const movementScoreLabels = new Set<string>();
  const movementScores = analyzed ? suppliedMovementScores.map((value, index) => {
    const item = object(value, `movementScores[${index}]`);
    exactKeys(item, ["id", "label", "score", "observed", "evidenceIds"], `movementScores[${index}]`);
    const id = text(item.id, `movementScores[${index}].id`) as string;
    if (movementScoreIds.has(id)) throw new Error("movementScores IDs must be unique");
    movementScoreIds.add(id);
    const label = text(item.label, `movementScores[${index}].label`) as string;
    const normalizedLabel = label.toLocaleLowerCase().trim();
    if (movementScoreLabels.has(normalizedLabel)) throw new Error("movementScores labels must be unique");
    movementScoreLabels.add(normalizedLabel);
    const evidenceIds = stringArray(
      item.evidenceIds,
      `movementScores[${index}].evidenceIds`,
    ).filter((evidenceId) => findingIds.has(evidenceId));
    return {
      id,
      label,
      score: number(item.score, `movementScores[${index}].score`, 0, 100),
      observed: visibleMovementText(item.observed, `movementScores[${index}].observed`) as string,
      evidenceIds,
    };
  }) : [];

  const setContext = object(result.setContext, "setContext");
  exactKeys(setContext, ["cameraView", "visibleReferences", "sequenceSummary", "changeAcrossSet", "coachingBasis"], "setContext");
  const parsedSetContext = { cameraView: text(setContext.cameraView, "setContext.cameraView", true), visibleReferences: stringArray(setContext.visibleReferences, "setContext.visibleReferences"), sequenceSummary: text(setContext.sequenceSummary, "setContext.sequenceSummary", true), changeAcrossSet: text(setContext.changeAcrossSet, "setContext.changeAcrossSet", true), coachingBasis: text(setContext.coachingBasis, "setContext.coachingBasis", true) };

  const setSummary = result.setSummary === undefined
    ? { totalReps: null, consistentReps: null, verdict: result.overallAssessment ?? null }
    : object(result.setSummary, "setSummary");
  exactKeys(setSummary, ["totalReps", "consistentReps", "verdict"], "setSummary");
  let totalReps = setSummary.totalReps === null ? null : integer(setSummary.totalReps, "setSummary.totalReps", 1, 10_000);
  let consistentReps = setSummary.consistentReps === null ? null : integer(setSummary.consistentReps, "setSummary.consistentReps", 0, 10_000);
  if (totalReps !== null && totalReps !== repTimeline.length) {
    totalReps = null;
    consistentReps = null;
  } else if (totalReps === null || (consistentReps !== null && consistentReps > totalReps)) {
    consistentReps = null;
  }
  const parsedSetSummary = { totalReps, consistentReps, verdict: text(setSummary.verdict, "setSummary.verdict", true) };

  const suppliedNextSetPlan = result.nextSetPlan === undefined ? [] : result.nextSetPlan;
  if (!Array.isArray(suppliedNextSetPlan)) throw new Error("nextSetPlan must be an array");
  const nextSetPlanIdCounts = new Map<string, number>();
  const nextSetPlan = suppliedNextSetPlan.map((value, index) => {
    const item = object(value, `nextSetPlan[${index}]`);
    exactKeys(item, ["id", "action", "rationale", "successCheck", "relatedFindingId"], `nextSetPlan[${index}]`);
    const suppliedRelatedFindingId = text(item.relatedFindingId, `nextSetPlan[${index}].relatedFindingId`, true);
    const relatedFindingId = suppliedRelatedFindingId && correctionIds.has(suppliedRelatedFindingId) ? suppliedRelatedFindingId : null;
    const suppliedId = text(item.id, `nextSetPlan[${index}].id`) as string;
    const idCount = nextSetPlanIdCounts.get(suppliedId) ?? 0;
    nextSetPlanIdCounts.set(suppliedId, idCount + 1);
    return {
      id: idCount === 0 ? suppliedId : `${suppliedId}-${idCount + 1}`,
      action: visibleMovementText(item.action, `nextSetPlan[${index}].action`) as string,
      rationale: visibleMovementText(item.rationale, `nextSetPlan[${index}].rationale`) as string,
      successCheck: visibleMovementText(item.successCheck, `nextSetPlan[${index}].successCheck`) as string,
      relatedFindingId,
    };
  }).filter((item) => !declaration || item.relatedFindingId !== null);

  const rawScore = result.score === null ? null : number(result.score, "score", 0, 100);
  const parsedScore = rawScore === null
    ? null
    : calibratedTechniqueScore(rawScore, findings.filter((finding) => finding.kind === "correction"));
  const authoritativeRecognition = declaration ? {
    ...parsedRecognition,
    label: declaration.exercise.label,
    confidence: 1,
    alternatives: [],
    catalogExerciseId: declaration.exercise.catalogExerciseId,
    source: "user_declared" as const,
  } : parsedRecognition;
  if (declaration?.amount.kind === "reps") {
    totalReps = declaration.amount.value;
    if (consistentReps !== null && consistentReps > totalReps) consistentReps = null;
  } else if (declaration?.amount.kind === "seconds") {
    totalReps = null;
    consistentReps = null;
  }
  const authoritativeSetSummary = { ...parsedSetSummary, totalReps, consistentReps };
  if (analyzed && (!authoritativeRecognition.label || parsedScore === null || !result.overallAssessment)) throw new Error("Analyzed results require declared identity, score, and assessment");
  if (!analyzed && (findings.length > 0 || result.score !== null || nextSetPlan.length > 0 || !parsedVideoCheck.retryReason || !parsedVideoCheck.retryInstruction)) throw new Error("Unable results require retry guidance and cannot contain scores, findings, or coaching");
  return {
    status: result.status as AnalysisDecision["status"],
    recognition: authoritativeRecognition,
    videoCheck: parsedVideoCheck,
    wholeSetCoverage,
    movementAnalysis,
    overallAssessment: visibleMovementText(result.overallAssessment, "overallAssessment", true),
    score: parsedScore,
    scoreRationale,
    movementScores,
    findings,
    equipmentObservations,
    ...(exerciseGuide ? { exerciseGuide } : {}),
    ...(coachingCoverage.length > 0 ? { coachingCoverage } : {}),
    setContext: parsedSetContext,
    setSummary: authoritativeSetSummary,
    repTimeline,
    nextSetPlan,
  };
}

export function parseWriterCopyPatch(value: unknown, decision: AnalysisDecision): WriterCopyPatch {
  const patch = object(value, "writer copy");
  exactKeys(patch, ["overallAssessment", "muscleFocus", "coachNote", "findings"], "writer copy");
  const overallAssessment = groundedWriterText(patch.overallAssessment, "writer copy overallAssessment");
  const overallAssessmentSentences = sentenceCount(overallAssessment);
  if (overallAssessmentSentences < 1 || overallAssessmentSentences > 2 || wordCount(overallAssessment) > 45) {
    throw new Error("writer copy overallAssessment must contain one or two sentences and no more than 45 words");
  }
  const muscleFocus = parseMuscleFocus(patch.muscleFocus);
  const coachNote = groundedWriterText(patch.coachNote, "writer copy coachNote");
  if (sentenceCount(coachNote) !== 1 || wordCount(coachNote) > 24) {
    throw new Error("writer copy coachNote must contain exactly one sentence and no more than 24 words");
  }
  const coachableIds = new Set(decision.findings.filter((finding) => finding.kind === "correction" || finding.kind === "cue").map((finding) => finding.id));
  if (!Array.isArray(patch.findings)) throw new Error("writer copy findings must be an array");
  const findings = patch.findings.map((value, index) => {
    const item = object(value, `writer copy findings[${index}]`);
    exactKeys(item, ["findingId", "title", "whatHappened", "whyItMatters", "whatToDo"], `writer copy findings[${index}]`);
    const findingId = text(item.findingId, `writer copy findings[${index}].findingId`) as string;
    if (!coachableIds.has(findingId)) throw new Error(`writer copy references unknown correction or advice topic ${findingId}`);
    const sourceFinding = decision.findings.find((finding) => finding.id === findingId);
    const title = groundedWriterText(item.title, `writer copy findings[${index}].title`);
    let whatHappened = groundedWriterText(item.whatHappened, `writer copy findings[${index}].whatHappened`);
    const whyItMatters = groundedWriterText(item.whyItMatters, `writer copy findings[${index}].whyItMatters`);
    const whatToDo = groundedWriterText(item.whatToDo, `writer copy findings[${index}].whatToDo`);
    if (DEPTH_OR_RANGE_COMMAND.test(whatToDo) && (!COMFORT_LANGUAGE.test(whatToDo) || !CONTROL_LANGUAGE.test(whatToDo))) {
      throw new Error(`writer copy findings[${index}].whatToDo must say to use only a comfortable, controlled range`);
    }
    const sourceSupportsRecurrence = Boolean(sourceFinding && (sourceFinding.evidence.length > 1 || claimsRecurrence(sourceFinding.detail)));
    if (sourceFinding?.kind === "cue") {
      whatHappened = adviceWhatHappened(sourceFinding);
    } else if (!sourceSupportsRecurrence && claimsRecurrence(whatHappened)) {
      whatHappened = sourceFinding?.detail ?? whatHappened;
    }
    return { findingId, title, whatHappened, whyItMatters, whatToDo };
  });
  if (new Set(findings.map((item) => item.findingId)).size !== findings.length) throw new Error("writer copy finding IDs must be unique");
  if (findings.length !== coachableIds.size || findings.some((finding) => !coachableIds.has(finding.findingId))) {
    throw new Error("writer copy must include every correction and advice topic exactly once");
  }
  return { overallAssessment, muscleFocus, coachNote, findings };
}

function rawRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function rawNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function detectRawFactualContradictions(value: unknown, durationMs: number): FactualContradiction[] {
  const analysis = rawRecord(value);
  if (!analysis) return [];
  const contradictions: FactualContradiction[] = [];
  const timeline = Array.isArray(analysis.repTimeline)
    ? analysis.repTimeline.map(rawRecord).filter((item): item is JsonRecord => item !== null)
    : [];
  const summary = rawRecord(analysis.setSummary);
  const totalReps = rawNumber(summary?.totalReps);
  const consistentReps = rawNumber(summary?.consistentReps);
  if (totalReps !== null && totalReps !== timeline.length) {
    contradictions.push({
      kind: "rep_count",
      findingId: null,
      startMs: null,
      endMs: null,
      description: `The set summary reports ${totalReps} repetitions while the timeline contains ${timeline.length}.`,
    });
  }
  if (totalReps !== null && consistentReps !== null && consistentReps > totalReps) {
    contradictions.push({
      kind: "rep_count",
      findingId: null,
      startMs: null,
      endMs: null,
      description: "The consistent repetition count is greater than the total repetition count.",
    });
  }

  const reps = new Map<number, JsonRecord>();
  timeline.forEach((rep) => {
    const repNumber = rawNumber(rep.repNumber);
    if (repNumber !== null) reps.set(repNumber, rep);
  });
  const inventories = ["findings", "formCorrections", "additionalCorrections", "corrections", "strengths", "cues"]
    .flatMap((key) => Array.isArray(analysis[key]) ? analysis[key] as unknown[] : []);
  const findings = inventories.map(rawRecord).filter((item): item is JsonRecord => item !== null);
  findings.forEach((finding) => {
    const findingId = typeof finding.id === "string" ? finding.id : null;
    const evidence = Array.isArray(finding.evidence)
      ? finding.evidence.map(rawRecord).filter((item): item is JsonRecord => item !== null)
      : [];
    evidence.forEach((moment) => {
      const repNumber = rawNumber(moment.repNumber);
      const peakMs = rawNumber(moment.peakMs);
      const startMs = rawNumber(moment.startMs);
      const endMs = rawNumber(moment.endMs);
      if (peakMs !== null && (peakMs < 0 || peakMs > durationMs)) {
        contradictions.push({ kind: "timestamp", findingId, startMs, endMs, description: "Finding evidence points outside the recording." });
        return;
      }
      if (repNumber === null || peakMs === null) return;
      const rep = reps.get(repNumber);
      const repStart = rawNumber(rep?.startMs);
      const repEnd = rawNumber(rep?.endMs);
      if (!rep || repStart === null || repEnd === null || peakMs < repStart - EVIDENCE_REP_TOLERANCE_MS || peakMs > repEnd + EVIDENCE_REP_TOLERANCE_MS) {
        contradictions.push({
          kind: "timestamp",
          findingId,
          startMs,
          endMs,
          description: `Finding evidence at ${peakMs} ms does not agree with repetition ${repNumber}.`,
        });
      }
    });
  });

  const score = rawNumber(analysis.score);
  const severities = findings
    .filter((finding) =>
      finding.kind === "correction"
      || (Array.isArray(analysis.formCorrections) && (analysis.formCorrections as unknown[]).includes(finding))
      || (Array.isArray(analysis.additionalCorrections) && (analysis.additionalCorrections as unknown[]).includes(finding))
      || (Array.isArray(analysis.corrections) && (analysis.corrections as unknown[]).includes(finding))
    )
    .map((finding) => String(finding.severity));
  const highCount = severities.filter((severity) => severity === "high").length;
  const importantCount = severities.filter((severity) => severity === "important").length;
  const minimumScore = highCount === 0 ? (importantCount === 0 ? 82 : importantCount === 1 ? 76 : 70) : null;
  if (score !== null && minimumScore !== null && score < minimumScore) {
    const evidence = findings.flatMap((finding) => Array.isArray(finding.evidence) ? finding.evidence.map(rawRecord).filter((item): item is JsonRecord => item !== null) : []);
    contradictions.push({
      kind: "score",
      findingId: null,
      startMs: evidence.map((item) => rawNumber(item.startMs)).filter((item): item is number => item !== null).sort((a, b) => a - b)[0] ?? null,
      endMs: evidence.map((item) => rawNumber(item.endMs)).filter((item): item is number => item !== null).sort((a, b) => b - a)[0] ?? null,
      description: `The score of ${score} conflicts with the reported correction severities.`,
    });
  }

  const status = String(analysis.status ?? "");
  const videoCheck = rawRecord(analysis.videoCheck);
  const presenceChecks = Array.isArray(videoCheck?.movementPresence)
    ? videoCheck.movementPresence.map(rawRecord).filter((item): item is JsonRecord => item !== null)
    : [];
  if (status === "unable") {
    const visibleMovement = presenceChecks.find((item) => item.observedMovement === true);
    if (visibleMovement) {
      contradictions.push({
        kind: "status",
        findingId: null,
        startMs: rawNumber(visibleMovement.startMs),
        endMs: rawNumber(visibleMovement.endMs),
        description: "The movement-presence check found exercise motion while the result says the video is unusable.",
      });
    }
  }
  if ((status === "unable") !== (videoCheck?.outcome === "unable")) {
    contradictions.push({ kind: "status", findingId: null, startMs: null, endMs: null, description: "The analysis status and video-usability decision disagree." });
  }
  return contradictions.slice(0, 8);
}

export function parseWriterAuditResponse(value: unknown, decision: AnalysisDecision, durationMs: number): WriterAuditResponse {
  const response = object(value, "writer audit");
  exactKeys(response, ["coaching", "contradictions"], "writer audit");
  if (!Array.isArray(response.contradictions) || response.contradictions.length > 3) {
    throw new Error("writer audit contradictions must contain zero to three items");
  }
  const findingIds = new Set(decision.findings.map((finding) => finding.id));
  const kinds = ["observation", "score", "coaching", "rep_count", "timestamp", "status"];
  const contradictions = response.contradictions.map((value, index) => {
    const item = object(value, `writer audit contradictions[${index}]`);
    exactKeys(item, ["kind", "findingId", "startMs", "endMs", "description"], `writer audit contradictions[${index}]`);
    if (!kinds.includes(String(item.kind))) throw new Error(`writer audit contradictions[${index}].kind is invalid`);
    const findingId = item.findingId === null ? null : text(item.findingId, `writer audit contradictions[${index}].findingId`) as string;
    if (findingId && !findingIds.has(findingId)) throw new Error(`writer audit contradictions[${index}] references an unknown finding`);
    const startMs = item.startMs === null ? null : integer(item.startMs, `writer audit contradictions[${index}].startMs`, 0, Math.max(0, durationMs - 1));
    const endMs = item.endMs === null ? null : integer(item.endMs, `writer audit contradictions[${index}].endMs`, 1, durationMs);
    if ((startMs === null) !== (endMs === null) || (startMs !== null && endMs !== null && startMs >= endMs)) {
      throw new Error(`writer audit contradictions[${index}] must provide one valid timestamp window`);
    }
    return {
      kind: item.kind as FactualContradiction["kind"],
      findingId,
      startMs,
      endMs,
      description: text(item.description, `writer audit contradictions[${index}].description`) as string,
    };
  });
  return { coaching: parseWriterCopyPatch(response.coaching, decision), contradictions };
}

export function targetedReviewWindows(decision: AnalysisDecision, contradictions: FactualContradiction[], durationMs: number): Array<{ startMs: number; endMs: number }> {
  const byFinding = new Map(decision.findings.map((finding) => [finding.id, finding]));
  const rawWindows = contradictions.flatMap((contradiction) => {
    if (contradiction.startMs !== null && contradiction.endMs !== null) return [{ startMs: contradiction.startMs, endMs: contradiction.endMs }];
    const finding = contradiction.findingId ? byFinding.get(contradiction.findingId) : null;
    if (finding && finding.evidence.length > 0) return finding.evidence.map((moment) => ({ startMs: moment.startMs, endMs: moment.endMs }));
    const checkpoint = decision.wholeSetCoverage?.checkpoints[1] ?? decision.wholeSetCoverage?.checkpoints[0];
    return checkpoint ? [{ startMs: checkpoint.startMs, endMs: checkpoint.endMs }] : [{ startMs: 0, endMs: Math.min(durationMs, 4_000) }];
  }).map((window) => ({
    startMs: Math.max(0, window.startMs - 1_500),
    endMs: Math.min(durationMs, window.endMs + 1_500),
  })).map((window) => {
    if (window.endMs - window.startMs <= 12_000) return window;
    const center = (window.startMs + window.endMs) / 2;
    const startMs = Math.max(0, Math.round(center - 6_000));
    return { startMs, endMs: Math.min(durationMs, startMs + 12_000) };
  }).sort((left, right) => left.startMs - right.startMs);

  const merged: Array<{ startMs: number; endMs: number }> = [];
  rawWindows.forEach((window) => {
    const previous = merged[merged.length - 1];
    if (previous && window.startMs <= previous.endMs && Math.max(previous.endMs, window.endMs) - previous.startMs <= 12_000) {
      previous.endMs = Math.max(previous.endMs, window.endMs);
    } else {
      merged.push({ ...window });
    }
  });
  return merged.slice(0, 3);
}

export function parseCombinedAnalysisResponse(
  value: unknown,
  durationMs: number,
  declaration?: SetDeclaration,
): CombinedAnalysisResponse {
  const combined = object(value, "combined analysis");
  exactKeys(combined, ["analysis", "coaching"], "combined analysis");
  validateCombinedVisibleLanguage(combined.coaching, ["coaching"]);
  const rawAnalysis = object(combined.analysis, "combined analysis.analysis");
  for (const inventoryName of ["formCorrections", "additionalCorrections", "corrections", "strengths", "cues"]) {
    const inventory = rawAnalysis[inventoryName];
    if (inventory === undefined) continue;
    if (inventory === null && (inventoryName === "corrections" || inventoryName === "formCorrections")) continue;
    if (!Array.isArray(inventory)) throw new Error(`combined analysis.analysis.${inventoryName} must be an array`);
    inventory.forEach((value, index) => {
      const finding = object(value, `combined analysis.analysis.${inventoryName}[${index}]`);
      const detail = text(finding.detail, `combined analysis.analysis.${inventoryName}[${index}].detail`) as string;
      const evidence = Array.isArray(finding.evidence) ? finding.evidence : [];
      if (claimsRecurrence(detail) && evidence.length < 2) {
        const firstEvidence = evidence.length > 0
          ? object(evidence[0], `combined analysis.analysis.${inventoryName}[${index}].evidence[0]`)
          : null;
        finding.detail = firstEvidence
          ? singleEvidenceDetail(text(firstEvidence.visualEvidence, `combined analysis.analysis.${inventoryName}[${index}].evidence[0].visualEvidence`) as string)
          : detail.replace(RECURRENCE_LANGUAGE, "at the cited moment");
      }
    });
  }
  const decision = parseAnalysisDecision(combined.analysis, durationMs, declaration);
  if (decision.status === "unable") {
    if (combined.coaching !== null) throw new Error("unable combined analysis must return null coaching");
    return { decision, writerCopy: null };
  }
  if (combined.coaching === null || combined.coaching === undefined) {
    throw new Error("usable combined analysis requires coaching");
  }
  return {
    decision,
    writerCopy: parseWriterCopyPatch(combined.coaching, decision),
  };
}

export function mergeWriterCopy(decision: AnalysisDecision, patch: WriterCopyPatch | null): AnalysisCandidate {
  const findingCopy = new Map((patch?.findings ?? []).map((item) => [item.findingId, item]));
  const findings = decision.findings.map(({ kind: _kind, ...finding }) => {
    const copy = findingCopy.get(finding.id);
    const merged = copy ? {
      ...finding,
      title: copy.title,
      detail: copy.whatHappened,
      whyItMatters: copy.whyItMatters,
      correction: copy.whatToDo,
      cue: copy.whatToDo,
      actionableCorrection: {
        instruction: copy.whatToDo,
        cue: copy.whatToDo,
        successCheck: null,
        applyWhen: "Across the next set at the cited movement phase.",
      },
      expandedCoaching: {
        summary: copy.title,
        whatHappened: copy.whatHappened,
        whyItMatters: copy.whyItMatters,
        whatToDo: copy.whatToDo,
        successCheck: null,
      },
    } : finding;
    return {
      ...merged,
      evidence: merged.evidence.map((moment) => {
        return {
          ...moment,
          repNumber: moment.repNumber,
          confidence: Math.max(LEGACY_PUBLIC_EVIDENCE_CONFIDENCE, moment.confidence),
          focusRegion: moment.focusRegion ? { ...moment.focusRegion, confidence: Math.max(LEGACY_PUBLIC_FOCUS_CONFIDENCE, moment.focusRegion.confidence) } : null,
        };
      }),
    };
  }) as CoachingFinding[];
  const publicFindings = (kind: AnalysisFindingDecision["kind"]) => findings.filter((_finding, index) => decision.findings[index].kind === kind);
  const corrections = publicFindings("correction");
  const priorityCorrections = rankCorrections(corrections);
  const overallAssessment = patch?.overallAssessment ?? decision.overallAssessment;
  return {
    status: decision.status,
    recognition: decision.recognition,
    videoCheck: decision.videoCheck,
    overallAssessment,
    muscleFocus: patch?.muscleFocus ?? { primary: [], secondary: [], unclassified: [] },
    coachNote: patch?.coachNote ?? null,
    score: decision.score,
    scoreRationale: decision.scoreRationale.map(({ assessment: _assessment, ...rationale }) => rationale),
    movementScores: decision.movementScores,
    scorecard: null,
    equipmentObservations: decision.equipmentObservations,
    ...(decision.exerciseGuide ? { exerciseGuide: decision.exerciseGuide } : {}),
    ...((decision.coachingCoverage?.length ?? 0) > 0 ? { coachingCoverage: decision.coachingCoverage } : {}),
    didWell: publicFindings("strength"),
    priorityCorrections,
    coachingCues: publicFindings("cue"),
    setContext: decision.setContext,
    setSummary: { ...decision.setSummary, verdict: overallAssessment },
    repTimeline: decision.repTimeline,
    nextSetPlan: priorityCorrections.map((finding, index) => ({
      id: `priority-${index + 1}-${finding.id}`,
      action: finding.actionableCorrection?.instruction ?? finding.correction ?? finding.cue ?? finding.title,
      rationale: finding.whyItMatters,
      relatedFindingId: finding.id,
    })),
    precisionRequest: { requestedRuns: 0, reason: null, targets: [] },
    comparison: null,
  };
}

const nullableString = { type: ["string", "null"] };
const stringList = { type: "array", items: { type: "string" } };
const normalizedCoordinate = { type: "number", minimum: 0, maximum: 1 };
const requiredActionSchema = { type: "object", additionalProperties: false, required: ["instruction", "cue", "successCheck", "applyWhen"], properties: { instruction: { type: "string" }, cue: { type: "string" }, successCheck: nullableString, applyWhen: { type: "string" } } };
const actionSchema = { anyOf: [{ type: "null" }, requiredActionSchema] };
const expandedCoachingSchema = {
  anyOf: [
    { type: "null" },
    {
      type: "object",
      additionalProperties: false,
      required: ["summary", "whatHappened", "whyItMatters", "whatToDo", "successCheck"],
      properties: {
        summary: { type: "string" },
        whatHappened: { type: "string" },
        whyItMatters: { type: "string" },
        whatToDo: { type: "string" },
        successCheck: { type: "string" },
      },
    },
  ],
};
const evidenceSchema = { type: "object", additionalProperties: false, required: ["startMs", "peakMs", "endMs", "repNumber", "phase", "visualEvidence", "coachingNote", "visibleBodyAreas", "confidence", "focusRegion"], properties: { startMs: { type: "integer", minimum: 0 }, peakMs: { type: "integer", minimum: 0 }, endMs: { type: "integer", minimum: 1 }, repNumber: { type: ["integer", "null"], minimum: 1 }, phase: { type: ["string", "null"], enum: [...EVIDENCE_PHASES, null] }, visualEvidence: { type: "string" }, coachingNote: { type: "string" }, visibleBodyAreas: stringList, confidence: { type: "number", minimum: MIN_VISIBLE_EVIDENCE_CONFIDENCE, maximum: 1 }, focusRegion: { anyOf: [{ type: "null" }, { type: "object", additionalProperties: false, required: ["centerX", "centerY", "radius", "arrowFromX", "arrowFromY", "label", "confidence"], properties: { centerX: normalizedCoordinate, centerY: normalizedCoordinate, radius: { type: "number", minimum: 0.06, maximum: 0.3 }, arrowFromX: normalizedCoordinate, arrowFromY: normalizedCoordinate, label: { type: "string" }, confidence: { type: "number", minimum: MIN_VISIBLE_EVIDENCE_CONFIDENCE, maximum: 1 } } }] } } };
const focusRegionSchema = evidenceSchema.properties.focusRegion;
const equipmentEvidenceSchema = { type: "object", additionalProperties: false, required: ["startMs", "peakMs", "endMs", "visualEvidence", "visibleReferences", "confidence", "focusRegion"], properties: { startMs: { type: "integer", minimum: 0 }, peakMs: { type: "integer", minimum: 0, description: "Exact single frame where this visible setup or surroundings observation is clearest." }, endMs: { type: "integer", minimum: 1 }, visualEvidence: { type: "string" }, visibleReferences: stringList, confidence: { type: "number", minimum: MIN_VISIBLE_EVIDENCE_CONFIDENCE, maximum: 1 }, focusRegion: focusRegionSchema } };
const equipmentLoadSchema = {
  anyOf: [
    { type: "null" },
    {
      type: "object",
      additionalProperties: false,
      required: ["value", "unit", "scope", "certainty", "basis"],
      properties: {
        value: { type: "number", minimum: 0 },
        unit: { type: "string", enum: LOAD_UNITS },
        scope: { type: "string" },
        certainty: { type: "string", enum: ["exact_visible"] },
        basis: { type: "string", enum: ["readable_label", "readable_selector"] },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["value", "unit", "scope", "certainty", "basis"],
      properties: {
        value: { type: ["number", "null"], minimum: 0 },
        unit: { type: ["string", "null"], enum: [...LOAD_UNITS, null] },
        scope: nullableString,
        certainty: { type: "string", enum: ["partial_visible"] },
        basis: { type: "string", enum: ["counted_visible_plates"] },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["value", "unit", "scope", "certainty", "basis"],
      properties: {
        value: { type: "null" },
        unit: { type: "null" },
        scope: nullableString,
        certainty: { type: "string", enum: ["unknown"] },
        basis: { type: "string", enum: ["not_readable"] },
      },
    },
  ],
};
const equipmentObservationSchema = { type: "object", additionalProperties: false, required: ["id", "category", "title", "observation", "coachingRelevance", "load", "evidence"], properties: { id: { type: "string" }, category: { type: "string", enum: EQUIPMENT_CATEGORIES }, title: { type: "string" }, observation: { type: "string" }, coachingRelevance: nullableString, load: equipmentLoadSchema, evidence: { type: "array", minItems: 1, items: equipmentEvidenceSchema } } };
const modelFindingSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "kind", "coachingArea", "title", "detail", "whyItMatters", "correction", "cue", "severity", "evidence", "primaryEvidenceIndex", "observedIssueRegions"],
  properties: {
    id: { type: "string" },
    kind: { type: "string", enum: ["strength", "correction", "cue"] },
    coachingArea: { type: "string", enum: COACHING_AREAS, description: "Classify the visible topic without changing its priority. Setup, load, equipment, safety, grip, and support findings are full corrections when evidence-backed." },
    title: { type: "string" },
    detail: { type: "string" },
    whyItMatters: { type: "string" },
    correction: nullableString,
    cue: nullableString,
    severity: { type: "string", enum: ["note", "important", "high"] },
    evidence: { type: "array", minItems: 1, items: evidenceSchema },
    primaryEvidenceIndex: { type: "integer", minimum: 0, description: "Zero-based index of the evidence occurrence whose exact peakMs the results UI should show first." },
    observedIssueRegions: { type: "array", uniqueItems: true, items: { type: "string", enum: ANATOMY_REGIONS }, description: "Body regions visibly connected to this correction. Empty for strengths and non-body setup advice." },
  },
};
const wholeSetCheckpointSchema = { type: "object", additionalProperties: false, required: ["position", "startMs", "endMs", "observation"], properties: { position: { type: "string", enum: ["beginning", "middle", "end"] }, startMs: { type: "integer", minimum: 0 }, endMs: { type: "integer", minimum: 1 }, observation: { type: "string" } } };
const wholeSetCoverageSchema = { anyOf: [{ type: "null" }, { type: "object", additionalProperties: false, required: ["activeSetStartMs", "activeSetEndMs", "checkpoints", "changeAcrossSet"], properties: { activeSetStartMs: { type: "integer", minimum: 0 }, activeSetEndMs: { type: "integer", minimum: 1 }, checkpoints: { type: "array", minItems: 3, maxItems: 3, items: wholeSetCheckpointSchema }, changeAcrossSet: { type: "string" } } }] };
const movementAnalysisSchema = { type: ["string", "null"], description: "A movement-first record for the declared exercise. For usable video, include labeled Joint actions, Implement path, Movement pattern, and Full-set progression observations. Return null only when status is unable." };
const repTimelineSchema = { type: "array", items: { type: "object", additionalProperties: false, required: ["repNumber", "startMs", "peakMs", "endMs", "assessment", "note"], properties: { repNumber: { type: "integer", minimum: 1 }, startMs: { type: "integer", minimum: 0 }, peakMs: { type: "integer", minimum: 0 }, endMs: { type: "integer", minimum: 1 }, assessment: { type: "string", enum: ["strong", "consistent", "breakdown", "uncertain"] }, note: { type: "string" } } } };
const movementPresenceSchema = {
  type: "array",
  minItems: 3,
  maxItems: 3,
  items: {
    type: "object",
    additionalProperties: false,
    required: ["position", "startMs", "endMs", "observedMovement", "observation"],
    properties: {
      position: { type: "string", enum: ["beginning", "middle", "end"] },
      startMs: { type: "integer", minimum: 0 },
      endMs: { type: "integer", minimum: 1 },
      observedMovement: { type: "boolean" },
      observation: { type: "string" },
    },
  },
};
const videoCheckSchema = { type: "object", additionalProperties: false, required: ["outcome", "usableObservations", "limitations", "retryReason", "retryInstruction", "movementPresence"], properties: { outcome: { type: "string", enum: ["usable", "partial", "unable"] }, usableObservations: stringList, limitations: stringList, retryReason: nullableString, retryInstruction: nullableString, movementPresence: movementPresenceSchema } };
const movementScoreSchema = { type: "object", additionalProperties: false, required: ["id", "label", "score", "observed", "evidenceIds"], properties: { id: { type: "string" }, label: { type: "string" }, score: { type: "number", minimum: 0, maximum: 100 }, observed: { type: "string" }, evidenceIds: stringList } };
const exerciseGuideSchema = {
  anyOf: [
    { type: "null" },
    {
      type: "object",
      additionalProperties: false,
      required: ["setupSteps", "executionSteps", "relatedFindingIds"],
      properties: {
        setupSteps: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
        executionSteps: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
        relatedFindingIds: stringList,
      },
    },
  ],
};
const coachingCoverageSchema = {
  type: "array",
  minItems: 6,
  maxItems: 6,
  description: `Return exactly once and in this order: ${COACHING_COVERAGE_DOMAINS.join(", ")}.`,
  items: {
    type: "object",
    additionalProperties: false,
    required: ["domain", "status", "observation", "findingIds"],
    properties: {
      domain: { type: "string", enum: COACHING_COVERAGE_DOMAINS },
      status: { type: "string", enum: ["issue", "clear", "not_visible"] },
      observation: { type: "string" },
      findingIds: stringList,
    },
  },
};
export const ANALYSIS_DECISION_SCHEMA = {
  type: "object", additionalProperties: false,
  $defs: { finding: modelFindingSchema },
  required: ["status", "videoCheck", "wholeSetCoverage", "movementAnalysis", "overallAssessment", "score", "scoreRationale", "movementScores", "corrections", "strengths", "cues", "equipmentObservations", "setContext", "repTimeline"],
  properties: {
    status: { type: "string", enum: ["complete", "partial", "unable"] },
    videoCheck: videoCheckSchema,
    wholeSetCoverage: wholeSetCoverageSchema,
    movementAnalysis: movementAnalysisSchema,
    overallAssessment: nullableString,
    score: { type: ["number", "null"], minimum: 0, maximum: 100, description: "Evidence-proportional visible form score. Minor isolated refinements keep a technically sound set in a strong range; only repeated major breakdowns justify a low score." },
    scoreRationale: { type: "array", minItems: 5, maxItems: 5, items: { type: "object", additionalProperties: false, required: ["criterion", "assessment", "observed", "impact", "confidence", "evidenceIds"], properties: { criterion: { type: "string", enum: SCORE_KEYS }, assessment: { type: "string", enum: ["strong", "issue", "limited"] }, observed: { type: "string" }, impact: { type: ["number", "null"], minimum: 0, maximum: 100 }, confidence: { type: "number", minimum: 0, maximum: 1 }, evidenceIds: stringList } } },
    movementScores: {
      anyOf: [
        { type: "array", maxItems: 0, items: movementScoreSchema },
        { type: "array", minItems: 3, maxItems: 5, uniqueItems: true, description: "Three to five distinct categories specific to the declared exercise and visible set.", items: movementScoreSchema },
      ],
    },
    corrections: { type: ["array", "null"], minItems: MIN_CORRECTION_PROBLEMS, description: "For complete or partial status, return at least four distinct evidence-backed corrections from real repetitions inside the active-set interval, with no invented faults and no maximum count. Movement path, range, control, body position, in-rep stance, grip, support, balance, and equipment motion can count when directly visible during the exercise. Never use pre-set or post-set actions. Return null only for unable status.", items: { $ref: "#/$defs/finding" } },
    strengths: { type: "array", description: "Distinct evidence-backed strengths. Strengths remain separate and never count toward the four-correction requirement.", items: { $ref: "#/$defs/finding" } },
    cues: { type: "array", description: "Exercise-specific general advice that is separate from observed problems. Clearly label each cue as general advice rather than an observed fault, anchor it to the relevant visible setup or movement phase, and include actionableCorrection.", items: { $ref: "#/$defs/finding" } },
    equipmentObservations: { type: "array", description: "Visible surroundings, equipment, load, stance, posture, lean, balance, and support observations that are useful for the next set. Never infer hidden or unreadable details.", items: equipmentObservationSchema },
    setContext: { type: "object", additionalProperties: false, required: ["cameraView", "visibleReferences", "sequenceSummary", "changeAcrossSet", "coachingBasis"], properties: { cameraView: nullableString, visibleReferences: stringList, sequenceSummary: nullableString, changeAcrossSet: nullableString, coachingBasis: nullableString } },
    repTimeline: repTimelineSchema,
  },
} as const;

export const WRITER_COPY_SCHEMA = {
  type: "object", additionalProperties: false, required: ["overallAssessment", "muscleFocus", "coachNote", "findings"], properties: {
    overallAssessment: { type: "string", description: "One or two sentences and no more than 45 words." },
    muscleFocus: {
      type: "object",
      additionalProperties: false,
      required: ["primary", "secondary"],
      properties: {
        primary: { type: "array", minItems: 1, maxItems: 8, items: { type: "object", additionalProperties: false, required: ["name", "region"], properties: { name: { type: "string" }, region: { type: "string", enum: MUSCLE_REGIONS } } } },
        secondary: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false, required: ["name", "region"], properties: { name: { type: "string" }, region: { type: "string", enum: MUSCLE_REGIONS } } } },
      },
    },
    coachNote: { type: "string", description: "Exactly one personalized sentence and no more than 24 words." },
    findings: { type: "array", items: { type: "object", additionalProperties: false, required: ["findingId", "title", "whatHappened", "whyItMatters", "whatToDo"], properties: { findingId: { type: "string" }, title: { type: "string" }, whatHappened: { type: "string" }, whyItMatters: { type: "string" }, whatToDo: { type: "string", description: "One direct gym cue. Describe a visible setup or movement relationship instead of saying brace, braced, or bracing. A depth or range cue must explicitly say to go only as low as feels comfortable while staying controlled." } } } },
  },
} as const;

const contradictionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "findingId", "startMs", "endMs", "description"],
  properties: {
    kind: { type: "string", enum: ["observation", "score", "coaching", "rep_count", "timestamp", "status"] },
    findingId: nullableString,
    startMs: { type: ["integer", "null"], minimum: 0 },
    endMs: { type: ["integer", "null"], minimum: 1 },
    description: { type: "string" },
  },
} as const;

export const WRITER_AUDIT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["coaching", "contradictions"],
  properties: {
    coaching: WRITER_COPY_SCHEMA,
    contradictions: { type: "array", maxItems: 3, items: contradictionSchema },
  },
} as const;

export const COMBINED_ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  $defs: ANALYSIS_DECISION_SCHEMA.$defs,
  required: ["analysis", "coaching"],
  properties: {
    analysis: ANALYSIS_DECISION_SCHEMA,
    coaching: {
      anyOf: [
        { type: "null" },
        WRITER_COPY_SCHEMA,
      ],
    },
  },
} as const;

export function writerCopySchema(decision: AnalysisDecision): JsonRecord {
  const coachableIds = decision.findings
    .filter((finding) => finding.kind === "correction" || finding.kind === "cue")
    .map((finding) => finding.id);
  const findingsSchema = WRITER_COPY_SCHEMA.properties.findings;
  const itemSchema = findingsSchema.items;
  return {
    ...WRITER_COPY_SCHEMA,
    properties: {
      ...WRITER_COPY_SCHEMA.properties,
      findings: {
        ...findingsSchema,
        minItems: coachableIds.length,
        maxItems: coachableIds.length,
        items: {
          ...itemSchema,
          properties: {
            ...itemSchema.properties,
            findingId: {
              ...itemSchema.properties.findingId,
              enum: coachableIds,
            },
          },
        },
      },
    },
  };
}

export function writerAuditSchema(decision: AnalysisDecision): JsonRecord {
  return {
    ...WRITER_AUDIT_SCHEMA,
    properties: {
      ...WRITER_AUDIT_SCHEMA.properties,
      coaching: writerCopySchema(decision),
    },
  };
}

function declarationPrompt(declaration?: SetDeclaration): string {
  if (!declaration) return "";
  const amount = `${declaration.amount.value} ${declaration.amount.kind}${declaration.amount.kind === "reps" && declaration.amount.countScope === "per_side" ? " per side" : ""}`;
  const load = declaration.load.kind === "known"
    ? `${declaration.load.value} ${declaration.load.unit} ${declaration.load.scope.replaceAll("_", " ")}`
    : declaration.load.kind;
  const styles = declaration.styles.length > 0 ? declaration.styles.join(", ").replaceAll("_", " ") : "none declared";
  return `
AUTHORITATIVE USER DECLARATION
The user performed ${declaration.exercise.label} for ${amount}. The declared load is ${load}. Side pattern: ${declaration.side ?? "not applicable"}. Intentional styles: ${styles}. Extra focus: ${declaration.focusNote ?? "none"}.
  This declaration is authoritative. Do not identify, rename, replace, count, or second-guess the exercise or completed amount. Inspect the declared mechanics across the complete active set. Treat every declared style as intentional context, not an automatic error.
First calibrate camera perspective using gravity, camera height, oblique projection, camera-to-subject distance, viewing direction, visible landmarks, support geometry, and obscured dimensions. Account for foreshortening: a segment aimed toward or away from the lens can look shorter, less displaced, or differently aligned on screen without the body relationship changing. Compare body-relative and equipment-relative landmarks across equivalent phases instead of treating screen coordinates as physical depth. Separate apparent screen angle from actual body or bench angle. If distance or viewing direction hides depth, record that limitation and lower confidence rather than inventing a fault. Camera limitations lower confidence only; they never lower the technique score.
Never reject the user's declaration, rename the movement, or return unable because the visible movement appears different from ${declaration.exercise.label}. Continue analyzing the recorded movement using ${declaration.exercise.label} as the authoritative coaching context, including when the execution is unusual, incomplete, or technically incorrect. Return unable only when no meaningful human exercise movement can be analyzed.
`;
}

export function buildSinglePassAnalysisPrompt(durationMs: number, declaration?: SetDeclaration): string {
  const identityInstructions = `The exercise identity and completed amount are application metadata, not analyst duties. Do not identify or rename the exercise. Use the declared exercise mechanics to interpret the observed load direction, implement path, joint actions, moving body segments, range, and reversal points across the beginning, middle, and end of the active set. Repetition timing is evidence bookkeeping only, never an exercise-identification task.`;
  return `You are Formie's full-video analyst. Watch the complete original recording from beginning to end before auditing every visible technique issue. The video lasts ${durationMs} ms. Return factual analysis that can support concise user-facing coaching.
${declarationPrompt(declaration)}

This may be a mobile recording whose stored pixel dimensions rely on rotation metadata. Before interpreting anatomy or movement direction, orient the person using gravity, the floor, the bench, and other stable scene references so the person is visually upright. Never analyze a sideways storage orientation as though it were the intended viewing orientation.

Before returning unable, fill videoCheck.movementPresence with exactly three ordered timestamp windows from the beginning, middle, and end of the recording. In each window, state whether meaningful human exercise movement is visible and name the body or implement displacement used to decide. Compare the implement and the major visible joints at separated moments. Any repeated implement displacement, repeated joint bending and straightening, or a repeated path away from and back toward a start position is active exercise movement and must be analyzed. When a rack is visible, separate stationary rack supports, safety rails, and hooks from the hand-held implement: track the object connected to the lifter's hands relative to those fixed references across time. You cannot return unable merely because the implement starts or ends on a rack, because the range is small, or because setup and finish occupy much of the video. Return unable for no movement only when all three separated checks show no meaningful repeated exercise motion.

First identify the continuous active-set interval from the start of the first real repetition through the end of the last real repetition. Setup, picking up or setting the implement down, repositioning, kneeling, standing, walking toward the camera, sitting or lying back down after the set, and leaving the bench are not repetitions. Ignore every non-exercise-specific movement and action outside that interval. Do not create repTimeline entries, findings, evidence, score deductions, summaries, or coaching about them. Phase labels must describe the actual exercise motion: top means the endpoint of that repetition's concentric phase, not merely a visually high or low implement position.

Before writing advice, complete this whole-movement evidence sequence in order:
1. Identify the first real repetition and the final real repetition.
2. Track the body, implement, and stable references through equivalent phases near the beginning, middle, and end.
3. Record the observed path, endpoints, range, tempo, stability, and any changes across the set.
4. Only after that record is complete, create corrections, strengths, scores, and summaries.
Do not let an obvious early issue stop the whole-video review.

Complete wholeSetCoverage and movementAnalysis in that order before filling the remaining output. For every complete or partial result, record the active-set start and end, then inspect exactly three ordered checkpoints spanning the beginning, middle, and end of that active set. Each checkpoint must use a valid timestamp window and state only what is visibly happening there. The beginning checkpoint center must fall in the first 40% of the active set, the middle in the middle 50%, and the end in the final 40%. Describe stable execution honestly when a section is clean; a checkpoint does not require a correction. Use changeAcrossSet to compare visible position, path, range, control, stability, and repeatability across those checkpoints. Return wholeSetCoverage null only when status is unable.

In movementAnalysis, write one concise evidence record with these four labeled parts in this order: "Joint actions:", "Implement path:", "Movement pattern:", and "Full-set progression:". Track the hand-held implement, working hand and wrist, working elbow and upper arm, torso and pelvis, and visible support points through equivalent phases near the beginning, middle, and end. Inside "Implement path:", state both (a) the intended visible endpoint relationship for the declared movement and (b) the actually observed path and endpoint relative to visible body landmarks, then state whether they match. This intended relationship is an evaluation reference, not an assumed fault. Never replace the observed path with the path you expect for the exercise. Full-set progression must cover the full active movement, including any visible change in path, range, control, position, or movement pattern. Return movementAnalysis null only when status is unable. Do not begin the correction inventory until this evidence record is complete.

${identityInstructions}

Use the segment that drives the repeated motion as a hard mechanics cross-check. Track the proximal and distal body segments independently, and identify which joints and segments produce the largest repeated displacement. The declared exercise family must explain the largest repeated body-segment and implement displacement seen across the complete set, rather than merely one familiar joint action.

Analyze only the exercise movement inside the active-set interval: every visible repetition, changes across the set, camera limitations, implement path, body position, range, tempo, control, and repeatability. Original pixels are the only source of truth. Never infer hidden muscle activation, pain, exact joint angles, or 3D depth. Audit every finding against the observed joint actions and implement path before returning.

Perform a dedicated path-and-endpoint audit before finalizing corrections. For the exact exercise and variation, visually locate the shoulder, working elbow, working hand or implement, hip or pelvis, torso, support points, and stable scene references at the start and endpoint of equivalent phases near the beginning, middle, and end. Determine the path from their observed displacement in the upright video, not from the path expected for the exercise. A smooth, controlled path can still be mechanically wrong. Try to falsify every proposed path strength across at least three separated repetitions before calling it strong.

Use this universal path decision gate before scoring path or writing any path strength:
1. Establish the intended start-to-end visible landmark relationship for the declared exercise.
2. Record the observed start, travel, and endpoint at equivalent phases near the beginning, middle, and end.
3. Compare intended and observed endpoints explicitly.
4. If they differ visibly, create the path or endpoint correction. Rank it against stance, setup, load, grip, equipment, support, and safety findings by actual severity and usefulness rather than by category. Consistency does not make a mismatched path correct.
5. Call path a strength only when both its repeatability and its endpoint relationship match the declared movement.

Evaluate stance, posture, torso position, balance, grip, support points, and equipment motion only when they are visibly part of performing a real repetition inside the active-set interval. A pre-set or post-set action is context to ignore, not a technique finding. Keep equipmentObservations empty unless an equipment relationship is directly visible during the exercise movement and materially helps interpret that movement.

Do not pre-write an expected correction for any exercise. Using the declared exercise context, compare the observed joint and implement endpoints with the appropriate visible body landmark for that exact movement. When relevant to the movement in the pixels, distinguish whether the elbow or implement actually travels toward a hip, rib, waist, or torso landmark or instead travels primarily straight upward toward the shoulder or ceiling. Staying close to the torso does not by itself prove a hip-directed path. This landmark comparison is an evidence method, not an assumed answer: return a correction only when the visible endpoint differs from the declared movement, and apply the same method to every exercise family.

For each likely correction, compare the same visible feature at equivalent phases across at least three repetitions when available. Specifically cross-check torso and shoulder orientation, implement path, joint endpoints, and support position at the same phase near the beginning, middle, and end. A planted hand or knee does not prove the torso stayed steady. If the same visible deviation appears in more than one separated repetition or in more than one whole-set checkpoint, it is recurring: include representative evidence moments, describe the actual recurrence, and it cannot be severity note. Severity note is only for an isolated and slight optimization. Use important for a recurring visible deviation that meaningfully changes position, path, range, control, or repeatability, and high for a major repeated or visibly safety-critical breakdown. Never attribute a repeated issue only to the final repetition or to fatigue when earlier equivalent phases show it too.

Rest between completed repetitions is not a technique error. Never create a correction whose main subject is pause duration, resting too long, set momentum, or between-rep cadence. Long pauses between repetitions may be described only as neutral context in setContext when useful, but they must not strongly lower the form score. Never use rest duration or between-rep cadence as scoring evidence. If execution changes after a pause, report only the visible position, path, range, stability, or control problem during the repetition.

Build repTimeline only when the complete repetition boundaries are visually clear across the active set. When the timeline is uncertain, return an empty repTimeline and use timestamps, movement phases, and beginning/middle/end language instead. Only attach repNumber to evidence when that number is validated by repTimeline; otherwise return repNumber null. Never guess a number from one isolated frame.

Every title, detail, rationale, whyItMatters, and coaching instruction must stay grounded in real repetitions inside the active-set interval. A correction must show a visible, actionable problem in the declared exercise's path, range, control, body position, in-rep stance, grip, support, balance, or equipment motion. Give small but real deviations severity note. Never turn sitting down, standing up, walking, repositioning, picking up equipment, putting equipment down, or interacting with the camera into a finding. Explain why a correction matters using repeatability, stability, control, range, visible position, or equipment path; never claim which muscle is working, losing focus, compensating, or receiving more load.
Describe the visible position or motion directly. Do not use internal-state words such as activate, engage, isolate, relax, tension, muscle focus, internal force, load distribution, muscle-powered, lengthened muscle, or contraction anywhere in user-facing analysis or coaching. Do not estimate degrees or numeric joint or torso angles. For example, replace "the arm relaxes" with the exact visible change such as "the shoulder drops," replace "keep the lat engaged" with a visible position or path cue, replace "maintain tension" with the visible benefit such as "keep the lowering path and endpoint repeatable," replace "peak contraction" with "top endpoint," and replace a degree estimate with a visible landmark relationship such as "the chest remains higher than the hips." Before returning, scan every user-facing field, including strengths, score observations, summaries, rationales, and cues, for these forbidden mechanism words or angle estimates and rewrite each one as a visible relationship.

Keep every correction semantically aligned. Its title, detail, evidence, and correction must all address the same visible body, implement, equipment, setup, load, support, or surroundings relationship. Its whyItMatters and cue must address that same relationship. The later coaching writer turns this factual inventory into the three carousel tabs and must not change the analyst-owned facts. Write the title as a neutral name for the observed relationship, never as an instruction or cue. For example, use "Dumbbell Finishes Forward of the Hip" rather than "Guide the Elbow Toward the Hip."
- A hip-directed cue requires an observed implement path or endpoint problem. Do not label an endpoint or path problem as elbow flare.
- Elbow flare requires visible evidence about the elbow's distance from the torso, and its cue must change that distance rather than substitute a different endpoint.
- Path example: if an implement finishes toward the shoulder instead of the waist, name the implement path or endpoint and cue that endpoint.
- Joint-alignment example: if a joint moves farther from a visible reference, name that distance and cue the joint back toward the reference.
- Range example: if the start or finish position shortens, name the missing endpoint and cue the person to reach that endpoint.
- Stability example: if the torso rotates relative to the bench or floor, name that rotation and cue the torso relationship.
- Tempo example: if the return speeds up relative to the opening repetitions, name the phase and cue a repeatable return pace.
These are relationship templates, not expected faults. Apply them only when the pixels support the named relationship.

A recurring claim in a correction, strength, score observation, or summary requires separated supporting moments from different repetitions or whole-set checkpoints. Evidence count determines temporal scope: one evidence moment supports only one isolated or uncertain occurrence, even if it spans a movement phase; two or more genuinely separated moments may support recurrence. Populate the evidence first, count the separated occurrences, and only then write the detail. With one evidence moment, explicitly anchor the detail to "the cited repetition," "the cited phase," or "this moment." Never use "throughout," "across the set," "during the repetitions," "consistently," "repeatedly," "every rep," or similar recurrence language without at least two separated evidence moments.

Build one ranked correction inventory, plus a separate strength inventory, before writing summaries. Inspect only the complete active exercise: in-rep stance and posture, torso position, grip or handle contact, support and balance, equipment path, concentric motion, endpoints, eccentric motion, transitions between real repetitions, and changes across the set. Cross-check alignment, symmetry, range, tempo, stability, and repetition consistency across the active-set interval. Return every distinct evidence-backed problem the repetitions support. Four is a minimum, not a maximum: continue past four whenever more independent visible exercise problems have useful corrections. Never invent a deviation, manufacture a safety concern, repeat the same topic, split one topic into several findings, infer a hidden mechanism, or use a non-exercise action to fill the count.
For strengths specifically, a phrase such as "across all repetitions," "throughout," "consistent," or "repeatable" requires at least two separated evidence moments in that strength's own evidence array. One representative frame never proves a whole-set strength. If only one strength moment is returned, describe only that cited repetition or phase.

Use the dedicated output arrays exactly as follows. For complete or partial status, corrections contains every distinct evidence-backed problem inside the active-set interval. Give each correction the coachingArea that best describes the in-rep issue: form, load, posture_setup, equipment, safety_surroundings, grip_contact, or support_balance. A category label never permits evidence from outside a real repetition. Strengths contain distinct visible exercise behaviors that were executed well and never count toward the correction minimum. Cues contain optional exercise-specific advice and never count as observed problems. Anchor every cue to an actual movement phase inside the active set. Do not claim pain prevention, hidden danger, or a safety problem that the exercise repetitions do not show.

Every complete or partial result must contain at least four distinct evidence-backed corrections from real exercise repetitions. In-rep stance, posture, grip, equipment path, support, balance, range, tempo, control, and alignment can each be one of the primary four when directly visible and actionable. Rank the complete inventory by severity, recurrence, confidence, and next-set usefulness, not by coachingArea. Return every additional supported correction after the first four. Do not turn a strength into a problem, duplicate one issue under several names, invent hidden mechanics, or score a pre-set or post-set action. If the active exercise cannot support four honest corrections, return unable. For unable status only, corrections must be null and strengths and cues must be empty.

Write each factual finding detail as one concise sentence. Keep every correction independently supported by its own visible evidence; the coaching writer will handle final phrasing.

For every usable or partially usable set, cover all five general scoring dimensions inside that same analysis: setup and stability, path and alignment, range and positions, control and tempo, and repetition consistency. Mark each scoreRationale dimension as strong, issue, or limited. Every dimension marked issue must reference at least one correction finding. Return one correction for every distinct clearly visible mistake found anywhere in the set, including minor mistakes. Include high-, medium-, and low-confidence visible corrections when the recording contains observable support; confidence describes evidence strength and is not a reason to omit a useful observation. Do not stop after finding one obvious issue. Retain note-level deviations that are independently visible and have a specific actionable cue. Do not merge separate visible problems into one finding, but do not create duplicate findings for the same problem. When one mistake recurs, use one finding with separate evidence moments for representative occurrences. Exclude pure guesses about hidden mechanics or details with no visible support. Put camera-hidden possibilities in videoCheck.limitations instead of presenting them as mistakes. Never relabel a supported visible mistake as a strength.

Return three to five exercise-specific score categories in movementScores. Choose labels that describe the declared exercise's actual visible demands rather than generic fixed dimensions. For a dumbbell shoulder press, relevant categories can include dumbbell path, torso stability, pressing range, tempo, and wrist alignment; select only categories the recording can show. A squat, row, curl, carry, or plank must use its own relevant category names. Keep labels distinct, keep each observation evidence-based, and use evidenceIds for the findings that explain a reduced category score. Category scores and the overall score must agree.

Every correction must include a direct correction instruction and visible evidence. The later writer expands that instruction into concise carousel coaching without changing the observed issue. Inspect neighboring sampled frames, then choose peakMs as the exact single frame with the clearest maximum visible deviation for that issue. The app seeks directly to peakMs, so select the moment the issue is actually happening—not the start, the end, a generic phase marker, or the middle by default. startMs and endMs are context boundaries only. Never default peakMs to startMs or endMs. For tempo, timing, control, or rep-to-rep changes, use the short evidence window to describe what becomes visible across neighboring frames, while peakMs still marks the clearest single frame in that change. Use only these phase values: setup, bottom, concentric, top, eccentric, transition, whole-set, or null. Keep startMs < peakMs < endMs and keep the evidence window at or below 4,000 ms. A transition may sit between its referenced repetition and the next repetition. Use separate evidence moments for separate occurrences.
Set primaryEvidenceIndex to the occurrence with the clearest exact peakMs. It must index that correction's evidence array.

Before finalizing, verify that corrections contains at least four distinct evidence-backed problems inside real repetitions and every other independently supported actionable exercise problem. Perform one final candidate audit across in-rep body position, stance and support, grip and handle use, equipment motion, alignment, path, endpoints, range, tempo, stability, control, and side-to-side symmetry at equivalent phases near the beginning, middle, and end of the active set. Use evidence-backed strengths only for visible positives. Recheck every timestamp against wholeSetCoverage and delete any candidate about actions before the first rep or after the last rep. If the active exercise cannot support four honest corrections, return unable with a specific recording instruction instead of fabricating advice.
Before finalizing strengths, re-read the "Implement path:" comparison. A visible mismatch between the declared movement's intended endpoint and the recorded endpoint cannot be omitted while path is praised as a strength.

Score accurately and own the numeric score yourself. Do not expect a later system to recalculate it. Judge only demonstrated execution quality. Do not lower the score merely because you found more corrections: correction coverage and score severity are separate. Do not deduct points for camera angle, occlusion, or a limited dimension; lower confidence instead. Low-confidence and note-level suggestions should have little or no effect on the score unless the same visible problem clearly recurs:
- 90-100: exceptional visible execution; 90-94 is highly consistent with only small isolated notes, while 95-100 is rare and nearly faultless.
- 80-89: good execution with several minor opportunities or one recurring moderate limiter, but no major repeated breakdown.
- 70-79: multiple important recurring problems or one major repeated breakdown that materially affects execution.
- 60-69: several major repeated breakdowns that substantially affect the set.
- Below 60: multiple severe, persistent, or visibly safety-critical breakdowns.
Apply these calibration constraints before finalizing the score:
- Never use 60-69 unless at least two high-severity problems repeat across the active set.
- For one important correction plus note-level corrections, use 76 as the minimum.
- For two or more recurring important corrections but no high-severity correction, use 70 as the minimum.
- For only note-level corrections, use 82 as the minimum.
- Long pauses between repetitions, deliberate pacing, and setup time may be useful coaching observations, but they must not strongly lower the form score unless they visibly cause loss of position, control, or repeatability during repetitions.
Keep score, severity, rationale, and findings mutually consistent. Use scoreRationale evidenceIds to reference finding IDs.
Express each scoreRationale impact as a 0-100 magnitude, where a larger number means that visible criterion mattered more to the final score. Never return a negative impact.
Return all five scoring dimensions exactly once in scoreRationale. Use evidenceIds for representative corrections that explain each dimension marked issue. Base the numeric score primarily on high-confidence important or high-severity corrections and how often they recur. Minor corrections remain useful coaching but should not compound into a harsh score. Before returning, self-check the score against demonstrated severity and repetition without omitting corrections merely to simplify score justification.

FINAL NUMERIC SELF-CHECK: Compare score against the final correction severities now. If no correction has severity high, score cannot be below 70. If there is exactly one important correction and all others are notes, score cannot be below 76. If every correction is a note, score cannot be below 82. Correct your own score before returning JSON; no later system will change it.
Do not apply a global upper cap merely because useful coaching notes exist. Preserve a strong score when the visible set is technically sound and the remaining feedback is isolated or minor. Scores above 90 still require repeatable strength across the visible exercise-specific categories.

Return unable when no meaningful human exercise movement can be analyzed or when the active-set interval is too incomplete to support four honest evidence-backed corrections. Fewer than four major faults is not itself a reason to reject a recording because smaller but genuinely visible in-rep stance, posture, grip, support, balance, path, range, tempo, and control problems count. Every complete or partial analysis must return at least four distinct corrections and every additional supported correction without inventing faults or using non-exercise actions. Return exactly one JSON object matching the supplied schema.`;
}

export function buildWriterCopyPrompt(decision: AnalysisDecision): string {
  return `Turn the supplied full-video analysis into direct, specific, candid coaching for the person in this recording. Do not add, remove, merge, or contradict corrections or advice cues. Do not change score, severity, evidence, timestamps, selected frames, or limitations. Return copy for every existing correction and cue findingId exactly once.

Write like a helpful trainer talking to a person at the gym. Use everyday words and short, natural sentences that a beginner can understand on the first read. Say rep instead of repetition, top or same height at the top instead of lockout, peak extension, or peak height, lifting and lowering part instead of concentric, eccentric, descent, or phase, bends backward instead of extension or hyperextension, wrists straight instead of neutral joints, and when you change direction instead of transition or reversal. Name the actual weight or equipment instead of calling it an implement. Say shoulder blade instead of scapula, upper back or chest position instead of thoracic position, and describe exactly what should move or stay still. Do not use biomechanics jargon, clinical language, academic movement terminology, or robotic phrases such as "the cited position," "movement relationship," or "visible landmark." If the analyst uses technical terms, translate them into normal language without changing the underlying observation.

Write overallAssessment as one or two sentences totaling no more than 45 words. Cover the overall execution pattern, meaningful strengths, and the primary weaknesses or next focus. Use the beginning, middle, and end checkpoints so this reads as a whole-set summary rather than a description of one frame.

Write muscleFocus as structured normal exercise anatomy. Put the declared exercise's primary intended targets in primary and normal secondary or supporting targets in secondary. For each item, provide its familiar display name and one matching region enum. Do not put a region in both lists. This is general exercise anatomy, never a claim about observed muscle activation in the recording. Write coachNote as exactly one personalized sentence totaling no more than 24 words that connects the person's strongest full-set pattern, biggest opportunity, and what visible progress should look like next time.

For every correction and advice cue, write one canonical set of coaching fields for the three-slide selector. For a correction, the title must neutrally name what changed; it must not be an instruction, command, or cue. For an advice cue, the title may name the setup, safety, or optimization reminder, and whatHappened must clearly say it is general next-set advice rather than a mistake observed in the recording:
- whatHappened: say exactly what the person visibly did, with a recommended range of one to three sentences. Refer to the actual exercise, weight or equipment, familiar body part, part of the rep, and supported beginning, middle, or end progression. If the issue is isolated, say so honestly instead of inventing recurrence.
- whyItMatters: give one simple practical reason in a recommended range of two to three sentences. Do not repeat the observation. Explain how it affects the path, range, control, steadiness, position, or ability to repeat the rep.
- whatToDo: give one clear cue as a physical instruction and, when useful, one easy visual success check in a recommended range of one to two sentences. Do not repeat the observation or rationale. Keep the instruction tied to the same familiar body part, weight, or equipment named by the analyst.
For any cue about increasing depth or range, use a comfort-based instruction such as "go as low as feels comfortable while staying controlled." Never prescribe a forced depth.

These ranges are guidance, not truncation rules or validation requirements. Use complete grammatical sentences with explicit subjects and verbs, natural transitions, and correct punctuation. Do not use fragments, compressed shorthand, headings disguised as sentences, awkward AI phrasing, or sentence fragments joined by slashes. Keep the voice calm and candid, not nagging, scolding, breathless, or overloaded with commands.

Make every correction easy to picture by describing one familiar body part or piece of equipment and one physical cue at a time. Personalize the wording to the recorded exercise, the actual weight or equipment, the part of the rep, and the supported change from beginning to middle to end. Use exact repetition numbers only when the immutable repTimeline validates them. Communicate each point clearly without repetition. Do not restate the same sentence across tabs, echo the tab prompt, use canned templates, repeat advice in different words, or pad the answer.

Keep coaching limited to visible steadiness, repeatability, position, range, control, and path. Outside muscleFocus, never claim pain, muscle activation, muscle isolation, internal force, load distribution, tension, exact joint angles, leverage, strain, joint loading, hidden compensation, or another mechanism the evidence does not visibly establish. Do not add recurrence that the immutable finding does not support. Count the immutable evidence moments before choosing temporal wording: when a finding has only one evidence moment, whatHappened must describe only that moment and must remove any unsupported "throughout," "across the set," "consistently," "repeatedly," or equivalent scope from the source detail. Removing unsupported temporal scope does not contradict the finding. Before returning JSON, scan overallAssessment, coachNote, every title, whatHappened, whyItMatters, and whatToDo for technical or clinical wording and for "activate," "engage," "isolate," "relax," "tension," "muscle focus," "internal force," "load distribution," "brace," "braced," and "bracing". Replace every occurrence with the exact familiar body part, weight, position, path, range, steadiness, control, or repeatability point. For example, replace bracing language with the ribs, back, torso, or support point the person should keep steady. For lowering tempo, never say it maintains tension or increases muscle benefit; explain only how it changes lowering control, path, position, or repeatability. Use normal gym language and name the actual weight or equipment accurately.

Immutable full-set analyst decision:
${JSON.stringify(decision)}`;
}

export function buildWriterAuditPrompt(decision: AnalysisDecision): string {
  return `${buildWriterCopyPrompt(decision)}

The factual analyst decision is immutable. Return an object with coaching and contradictions. In coaching.findings, include every correction and advice cue findingId exactly once and never include strength findingIds. First write coaching from those facts. Then compare observations, score, coaching, repetition counts, and timestamps for factual disagreements. Audit the complete evidence across equipment, grip, setup, posture, stance, range, tempo, and full-set changes.

Return contradictions only for a real factual disagreement that requires looking at the pixels again. Do not flag style preferences, plain-language rewrites, or missing polish. Use the smallest original-video startMs/endMs window that can settle each disagreement; use the related findingId when one exists. If everything agrees, return an empty contradictions array.`;
}

export function buildWriterCopyRepairPrompt(decision: AnalysisDecision, rejectedCopy: unknown, validationError: unknown): string {
  const reason = validationError instanceof Error ? validationError.message : String(validationError);
  return `${buildWriterCopyPrompt(decision)}

The previous coaching JSON was rejected by the application validator.
Validation issue: ${reason}
Rewrite the complete JSON object so it fixes that issue while preserving every immutable analyst finding and findingId. Do not explain the repair or return markdown.

Rejected coaching JSON:
${JSON.stringify(rejectedCopy)}`;
}

export function buildTargetedContradictionReviewPrompt(
  decision: AnalysisDecision,
  coaching: WriterCopyPatch | null,
  contradictions: FactualContradiction[],
): string {
  return `You are Formie's targeted factual reviewer. Only the supplied disputed clips are available because the rest of the recording has already been analyzed. Resolve only the listed contradictions from the pixels in those clips. Clip timestamps refer to the original recording timeline. Keep all user-facing coaching in everyday gym language that a beginner can understand immediately. Translate technical movement terms into familiar body-part and equipment words.

Return the complete analysis and coaching object. Preserve every fact, finding, score, repetition, timestamp, coachingArea, and coaching statement that is not implicated by a listed contradiction. Correct the disputed fields when the clip proves them wrong. Keep at least four distinct evidence-backed corrections whenever the video is usable and preserve every additional supported correction. All findings and repetition events must remain inside wholeSetCoverage from the first real rep through the last real rep. Ignore sitting down, standing up, walking, repositioning, picking up or putting down equipment, and camera interaction outside that interval. Only in-rep movement, stance, posture, grip, equipment path, support, balance, range, tempo, control, and alignment can count toward four. Return unable when the active exercise cannot support four honest corrections; never fabricate a correction to preserve the count.

Original factual decision:
${JSON.stringify(decision)}

Original coaching:
${JSON.stringify(coaching)}

Contradictions to resolve:
${JSON.stringify(contradictions)}`;
}

export function buildCombinedAnalysisPrompt(durationMs: number, declaration?: SetDeclaration): string {
  return `${buildSinglePassAnalysisPrompt(durationMs, declaration)}

Return one top-level object with analysis and coaching fields. Put the complete factual result described above in analysis. For complete or partial status, put the final user-facing copy in coaching; for unable status, coaching must be null.

Create coaching from the same complete-video inspection without changing or contradicting analysis. Include every correction ID exactly once as findingId. Keep evidence, timestamps, score, severity, and factual observations owned by analysis.
- overallAssessment: one or two sentences, no more than 45 words, summarizing the whole set.
- coachNote: exactly one personalized sentence, no more than 24 words.
- muscleFocus: general exercise anatomy only, never a claim about observed activation.
- whatHappened: only the objective visible action.
- whyItMatters: one visible movement principle without repeating the observation.
- whatToDo: one clear physical instruction and optional easy visual success check.

Write like a helpful trainer talking to a person at the gym. Use everyday words a beginner understands on the first read. Say rep instead of repetition, top or same height at the top instead of lockout, peak extension, or peak height, lifting and lowering part instead of concentric, eccentric, descent, or phase, bends backward instead of extension or hyperextension, wrists straight instead of neutral joints, and when you change direction instead of transition or reversal. Name the actual weight or equipment instead of "implement," and avoid biomechanics, clinical, or academic movement jargon.

Use the actual exercise, equipment or handle, weight path, support points, grip, posture, stance, range, tempo, and beginning-to-end changes visible during real repetitions inside wholeSetCoverage. Ignore every action before the first real rep and after the last real rep. Keep each correction's title and three coaching fields about the same point. Never add a finding, unsupported recurrence, hidden mechanism, exact joint angle, or fault that the pixels do not support. Return only JSON matching the supplied combined schema.`;
}

export function buildCombinedAnalysisRepairPrompt(
  durationMs: number,
  declaration: SetDeclaration | undefined,
  rejectedResponse: unknown,
  validationError: unknown,
): string {
  const reason = validationError instanceof Error ? validationError.message : String(validationError);
  return `You are repairing Formie's already-completed combined analysis JSON. Do not reanalyze the video or invent findings. Preserve factual observations and correction IDs unless the validation issue says their evidence falls outside wholeSetCoverage; in that case remove the invalid non-exercise finding or repetition event and update dependent coaching and score references. Return the complete top-level object with analysis and coaching fields using the supplied schema.

The recording duration is ${durationMs} ms. Declared exercise context: ${declaration?.exercise.label ?? "Exercise"}.
The previous combined JSON was rejected by the deterministic application validator.
Validation issue: ${reason}
Fix only the rejected structure or wording. Coaching overallAssessment must be one or two sentences and at most 45 words. coachNote must be exactly one sentence and at most 24 words. Remove unsupported recurrence, hidden force or protection claims, internal-state language, muscle-mechanism claims, numeric angle estimates, and technical biomechanics jargon. Replace repetition with rep; lockout, peak extension, or peak height with top or same height at the top; extension with bends backward or straightens; neutral joints with wrists straight; phase or descent with lifting part or lowering part; and transition or reversal with when you change direction. Write like a helpful trainer using familiar body-part and equipment words a beginner understands immediately. Use only visible position, path, range, steadiness, control, equipment, handle, posture, support, and repeatability language. Do not explain the repair or return markdown.

Rejected combined JSON:
${JSON.stringify(rejectedResponse)}`;
}
