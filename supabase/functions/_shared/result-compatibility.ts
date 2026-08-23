import type { AnalysisCandidate, MuscleFocus, MuscleRegion, PublicAnalysisResult } from "./analysis-contract.ts";

const MUSCLE_REGIONS = new Set<MuscleRegion>([
  "chest",
  "front_shoulders",
  "rear_shoulders",
  "upper_back",
  "lats",
  "biceps",
  "triceps",
  "forearms",
  "abs",
  "obliques",
  "lower_back",
  "glutes",
  "quads",
  "hamstrings",
  "adductors",
  "calves",
]);

const VIDEO_OUTCOMES = new Set(["usable", "partial", "unable"] as const);
type VideoOutcome = "usable" | "partial" | "unable";
type VideoCheck = NonNullable<AnalysisCandidate["videoCheck"]>;
type SetContext = AnalysisCandidate["setContext"];
type SetSummary = AnalysisCandidate["setSummary"];

const DEFAULT_RETRY_REASON = "The movement could not be reviewed.";
const DEFAULT_RETRY_INSTRUCTION = "Record the movement again.";

const DEFAULT_SET_CONTEXT: SetContext = {
  cameraView: null,
  visibleReferences: [],
  sequenceSummary: null,
  changeAcrossSet: null,
  coachingBasis: null,
};

const DEFAULT_SET_SUMMARY: SetSummary = {
  totalReps: null,
  consistentReps: null,
  verdict: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function read(source: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (key in source) return source[key];
  }
  return undefined;
}

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function cleanStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => {
    const cleaned = cleanString(item);
    return cleaned ? [cleaned] : [];
  }))];
}

function statusOutcome(status: unknown): VideoOutcome {
  if (status === "unable") return "unable";
  if (status === "partial") return "partial";
  return "usable";
}

/**
 * Normalizes the legacy persisted video-review field without making UI
 * decisions. A retry explanation is meaningful only when the result is
 * genuinely unusable.
 */
export function normalizeVideoCheck(status: unknown, value: unknown): VideoCheck {
  const source = isRecord(value) ? value : null;
  const derivedOutcome = statusOutcome(status);
  const persistedOutcome = source && VIDEO_OUTCOMES.has(source.outcome as VideoOutcome)
    ? source.outcome as VideoOutcome
    : null;
  const outcome = status === "unable"
    ? "unable"
    : persistedOutcome === "unable"
      ? derivedOutcome
      : persistedOutcome ?? derivedOutcome;
  const retryReason = outcome === "unable"
    ? cleanString(read(source ?? {}, "retryReason", "retry_reason")) ?? DEFAULT_RETRY_REASON
    : null;
  const retryInstruction = outcome === "unable"
    ? cleanString(read(source ?? {}, "retryInstruction", "retry_instruction")) ?? DEFAULT_RETRY_INSTRUCTION
    : null;
  return {
    outcome,
    usableObservations: cleanStringList(read(source ?? {}, "usableObservations", "usable_observations")),
    limitations: cleanStringList(read(source ?? {}, "limitations")),
    retryReason,
    retryInstruction,
  };
}

function normalizeMuscleTargets(value: unknown): MuscleFocus["primary"] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<MuscleRegion>();
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const name = cleanString(item.name);
    const region = typeof item.region === "string" && MUSCLE_REGIONS.has(item.region as MuscleRegion)
      ? item.region as MuscleRegion
      : null;
    if (!name || !region || seen.has(region)) return [];
    seen.add(region);
    return [{ name, region }];
  }).slice(0, 8);
}

/** Converts all supported historical muscle-focus shapes into one wire shape. */
export function normalizeMuscleFocus(value: unknown): MuscleFocus {
  if (Array.isArray(value)) {
    return {
      primary: [],
      secondary: [],
      unclassified: cleanStringList(value).slice(0, 8),
    };
  }
  if (!isRecord(value)) return { primary: [], secondary: [], unclassified: [] };

  const primary = normalizeMuscleTargets(read(value, "primary", "primary_muscles"));
  const primaryRegions = new Set(primary.map((target) => target.region));
  const secondary = normalizeMuscleTargets(read(value, "secondary", "secondary_muscles"))
    .filter((target) => !primaryRegions.has(target.region));
  return {
    primary,
    secondary,
    unclassified: cleanStringList(read(value, "unclassified", "unclassified_muscles")).slice(0, 8),
  };
}

/** Merges a partial persisted set context with the nullable legacy defaults. */
export function normalizeSetContext(value: unknown): SetContext {
  if (!isRecord(value)) return { ...DEFAULT_SET_CONTEXT };
  return {
    cameraView: cleanString(read(value, "cameraView", "camera_view")),
    visibleReferences: cleanStringList(read(value, "visibleReferences", "visible_references")),
    sequenceSummary: cleanString(read(value, "sequenceSummary", "sequence_summary")),
    changeAcrossSet: cleanString(read(value, "changeAcrossSet", "change_across_set")),
    coachingBasis: cleanString(read(value, "coachingBasis", "coaching_basis")),
  };
}

function cleanCount(value: unknown, positive: boolean): number | null {
  return typeof value === "number"
    && Number.isInteger(value)
    && Number.isFinite(value)
    && (positive ? value > 0 : value >= 0)
    ? value
    : null;
}

/** Merges a partial persisted set summary with nullable defaults. */
export function normalizeSetSummary(value: unknown): SetSummary {
  if (!isRecord(value)) return { ...DEFAULT_SET_SUMMARY };
  const totalReps = cleanCount(read(value, "totalReps", "total_reps"), true);
  const consistentReps = cleanCount(read(value, "consistentReps", "consistent_reps"), false);
  return {
    totalReps,
    consistentReps: totalReps !== null && consistentReps !== null && consistentReps > totalReps ? null : consistentReps,
    verdict: cleanString(read(value, "verdict")),
  };
}

/**
 * The only result shape allowed to leave an analysis-status branch. Branch
 * adapters can remain permissive, but this finalizer guarantees the fields
 * consumed by the installed client are present and structured.
 */
export function normalizePublicAnalysisResult(value: AnalysisCandidate | Record<string, unknown>): PublicAnalysisResult {
  const source = value as Record<string, unknown>;
  // Preserve an invalid status for the client parser to reject instead of
  // silently converting an incompatible server response into a partial one.
  const status = source.status;
  return {
    ...source,
    status,
    videoCheck: normalizeVideoCheck(status, read(source, "videoCheck", "video_check")),
    muscleFocus: normalizeMuscleFocus(read(source, "muscleFocus", "muscle_focus")),
    setContext: normalizeSetContext(read(source, "setContext", "set_context")),
    setSummary: normalizeSetSummary(read(source, "setSummary", "set_summary")),
  } as PublicAnalysisResult;
}
