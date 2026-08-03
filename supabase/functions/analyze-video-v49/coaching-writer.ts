import type { AnatomyRegion, CoachingArea, ExerciseFamily, MuscleFocus, MovementScore } from "../_shared/analysis-contract.ts";
import type { SetDeclaration } from "../_shared/set-declaration.ts";
import type { ProblemFinderProblem } from "./problem-finder.ts";

export type CatalogContext = { canonicalLabel: string; family: ExerciseFamily | null; equipment: string[] };
export type CoachingWriterInput = { declaration: SetDeclaration; catalogContext: CatalogContext; problems: ProblemFinderProblem[] };
export type WrittenCorrection = {
  problemId: string;
  title: string;
  whatHappened: string;
  whyItMatters: string;
  whatToDo: string;
  successCheck: string;
  severity: "note" | "important" | "high";
  coachingArea: CoachingArea;
  observedIssueRegions: AnatomyRegion[];
};
export type CoachingWriterResult = {
  overallAssessment: string;
  coachNote: string;
  score: number | null;
  movementScores: MovementScore[];
  muscleFocus: MuscleFocus;
  corrections: WrittenCorrection[];
  setSummary: { verdict: string };
  nextSetPlan: Array<{ problemId: string; action: string; rationale: string; successCheck: string }>;
};

type JsonRecord = Record<string, unknown>;
const SEVERITIES = new Set(["note", "important", "high"]);
const COACHING_AREAS = new Set<CoachingArea>(["form", "load", "posture_setup", "equipment", "safety_surroundings", "grip_contact", "support_balance"]);
const ANATOMY_REGIONS = new Set<AnatomyRegion>(["chest", "shoulders", "upper_back", "lats", "upper_arms", "elbows", "forearms", "wrists", "torso", "lower_back", "hips", "glutes", "quads", "hamstrings", "adductors", "knees", "calves", "ankles"]);
const MUSCLE_REGIONS = new Set(["chest", "front_shoulders", "rear_shoulders", "upper_back", "lats", "biceps", "triceps", "forearms", "abs", "obliques", "lower_back", "glutes", "quads", "hamstrings", "adductors", "calves"]);

function record(value: unknown, name: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as JsonRecord;
}
function text(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} must be non-empty text`);
  return value.trim();
}
function number(value: unknown, name: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error(`${name} is invalid`);
  return value;
}
function exactProblemOrder(value: unknown, problems: ProblemFinderProblem[], name: string): JsonRecord[] {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  const ids = value.map((entry, index) => text(record(entry, `${name}[${index}]`).problemId, `${name}[${index}].problemId`));
  if (ids.length !== problems.length || ids.some((id, index) => id !== problems[index].id)) throw new Error(`${name} problem IDs must exactly match the immutable problem IDs in order`);
  return value.map((entry, index) => record(entry, `${name}[${index}]`));
}

export function buildCoachingWriterPrompt(input: CoachingWriterInput): string {
  const equipmentRequirement = input.catalogContext.equipment.length > 0
    ? ` Each of those fields must also name the relevant equipment from ${JSON.stringify(input.catalogContext.equipment)}.`
    : "";
  return `You are Formie's exercise-specific coaching writer. Transform the immutable visual problems into clear coaching for the exact declared exercise. You must not add, remove, merge, split, rename, contradict, or reorder problems. Return exactly one correction and one next-set action for every problem ID, in the same order. Every statement about what was visible must come directly from an immutable problem. You must not invent positive visible facts, strengths, consistency, successful repetitions, or good technique. If the problem list is empty, use neutral language saying that the problem finder returned no visible problems; never call the performance good, great, excellent, or perfect. Every whatToDo, successCheck, and nextSetPlan action must literally name "${input.declaration.exercise.label}" and state the corrective direction.${equipmentRequirement} Every nextSetPlan.action must begin with "For your ${input.declaration.exercise.label}," and continue as a complete actionable sentence. Do not return fragmentary next-set actions. Use the least aggressive cue that directly corrects the observation while preserving a normal, comfortable range of motion for the declared exercise. Do not prescribe an extreme or absolute joint position unless the immutable problem explicitly requires it. Do not claim that a correction prevents injury, maximizes muscle recruitment, or transfers stress unless that claim is directly supported by the immutable input. Explain why the correction matters using calibrated language about the observed execution, not guaranteed physiological or safety outcomes. Success checks must be visible, testable, and proportional to the immutable observation. Preserve useful anatomical language such as cervical, thoracic, lumbar, scapular, trajectory, lockout, lat, muscle, or joint when it makes the coaching more precise; explain it plainly when useful. Return one issue score for each of the first four immutable problems, in their exact order. Each issue score ID and its only evidence ID must equal that problem ID. Do not score unobserved dimensions or return a separate overall score; deterministic code calculates the aggregate from the issue scores. Use an empty movementScores array when there are no problems. Otherwise use a 0-to-100 percentage scale. The set summary contains only a verdict; do not claim how many repetitions were consistent. Create the target-muscle map, issue-region map, assessment, and verdict only from the declaration and immutable problems. Return only JSON matching the schema.\n\nImmutable input:\n${JSON.stringify(input)}`;
}

const muscleTargetSchema = { type: "object", additionalProperties: false, required: ["name", "region"], properties: { name: { type: "string" }, region: { type: "string", enum: [...MUSCLE_REGIONS] } } } as const;
export const COACHING_WRITER_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["overallAssessment", "coachNote", "movementScores", "muscleFocus", "corrections", "setSummary", "nextSetPlan"],
  properties: {
    overallAssessment: { type: "string" }, coachNote: { type: "string" },
    movementScores: { type: "array", minItems: 0, maxItems: 4, items: { type: "object", additionalProperties: false, required: ["id", "label", "score", "observed", "evidenceIds"], properties: { id: { type: "string" }, label: { type: "string" }, score: { type: "number", minimum: 0, maximum: 100 }, observed: { type: "string" }, evidenceIds: { type: "array", items: { type: "string" } } } } },
    muscleFocus: { type: "object", additionalProperties: false, required: ["primary", "secondary", "unclassified"], properties: { primary: { type: "array", items: muscleTargetSchema }, secondary: { type: "array", items: muscleTargetSchema }, unclassified: { type: "array", items: { type: "string" } } } },
    corrections: { type: "array", items: { type: "object", additionalProperties: false, required: ["problemId", "title", "whatHappened", "whyItMatters", "whatToDo", "successCheck", "severity", "coachingArea", "observedIssueRegions"], properties: { problemId: { type: "string" }, title: { type: "string" }, whatHappened: { type: "string" }, whyItMatters: { type: "string" }, whatToDo: { type: "string" }, successCheck: { type: "string" }, severity: { type: "string", enum: [...SEVERITIES] }, coachingArea: { type: "string", enum: [...COACHING_AREAS] }, observedIssueRegions: { type: "array", minItems: 1, items: { type: "string", enum: [...ANATOMY_REGIONS] } } } } },
    setSummary: { type: "object", additionalProperties: false, required: ["verdict"], properties: { verdict: { type: "string" } } },
    nextSetPlan: { type: "array", items: { type: "object", additionalProperties: false, required: ["problemId", "action", "rationale", "successCheck"], properties: { problemId: { type: "string" }, action: { type: "string" }, rationale: { type: "string" }, successCheck: { type: "string" } } } },
  },
} as const;

function parseMuscleFocus(value: unknown): MuscleFocus {
  const focus = record(value, "muscleFocus");
  const parseTargets = (raw: unknown, name: string) => {
    if (!Array.isArray(raw)) throw new Error(`${name} must be an array`);
    return raw.map((entry, index) => {
      const target = record(entry, `${name}[${index}]`);
      const region = text(target.region, `${name}[${index}].region`);
      if (!MUSCLE_REGIONS.has(region)) throw new Error(`${name}[${index}].region is invalid`);
      return { name: text(target.name, `${name}[${index}].name`), region: region as MuscleFocus["primary"][number]["region"] };
    });
  };
  if (!Array.isArray(focus.unclassified) || focus.unclassified.some((item) => typeof item !== "string" || !item.trim())) throw new Error("muscleFocus.unclassified is invalid");
  const uniqueByRegion = <T extends { region: string }>(targets: T[]) => targets.filter((target, index) => targets.findIndex((candidate) => candidate.region === target.region) === index);
  const primary = uniqueByRegion(parseTargets(focus.primary, "muscleFocus.primary"));
  const primaryRegions = new Set(primary.map((target) => target.region));
  const secondary = uniqueByRegion(parseTargets(focus.secondary, "muscleFocus.secondary")).filter((target) => !primaryRegions.has(target.region));
  return { primary, secondary, unclassified: [...new Set(focus.unclassified.map((item) => String(item).trim()))] };
}

export function parseCoachingWriterResult(value: unknown, problems: ProblemFinderProblem[]): CoachingWriterResult {
  const result = record(value, "coaching writer result");
  const scoreProblems = problems.slice(0, 4);
  if (!Array.isArray(result.movementScores) || result.movementScores.length !== scoreProblems.length) throw new Error("movementScores must match the first four immutable problems");
  const movementScores = result.movementScores.map((entry, index) => {
    const score = record(entry, `movementScores[${index}]`);
    const expectedId = scoreProblems[index].id;
    if (score.id !== expectedId || !Array.isArray(score.evidenceIds) || score.evidenceIds.length !== 1 || score.evidenceIds[0] !== expectedId) throw new Error(`movementScores[${index}] must cite exactly its matching immutable problem ID`);
    return { id: text(score.id, `movementScores[${index}].id`), label: text(score.label, `movementScores[${index}].label`), score: number(score.score, `movementScores[${index}].score`, 0, 100), observed: text(score.observed, `movementScores[${index}].observed`), evidenceIds: score.evidenceIds as string[] };
  });
  if (new Set(movementScores.map((score) => score.id)).size !== movementScores.length || new Set(movementScores.map((score) => score.label.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim())).size !== movementScores.length) throw new Error("movementScores IDs and labels must be unique");
  const corrections = exactProblemOrder(result.corrections, problems, "corrections").map((item, index) => {
    const severity = text(item.severity, `corrections[${index}].severity`);
    const coachingArea = text(item.coachingArea, `corrections[${index}].coachingArea`);
    if (!SEVERITIES.has(severity) || !COACHING_AREAS.has(coachingArea as CoachingArea)) throw new Error(`corrections[${index}] classification is invalid`);
    if (!Array.isArray(item.observedIssueRegions) || item.observedIssueRegions.length === 0 || item.observedIssueRegions.some((region) => typeof region !== "string" || !ANATOMY_REGIONS.has(region as AnatomyRegion))) throw new Error(`corrections[${index}].observedIssueRegions is invalid`);
    return { problemId: problems[index].id, title: text(item.title, "title"), whatHappened: text(item.whatHappened, "whatHappened"), whyItMatters: text(item.whyItMatters, "whyItMatters"), whatToDo: text(item.whatToDo, "whatToDo"), successCheck: text(item.successCheck, "successCheck"), severity: severity as WrittenCorrection["severity"], coachingArea: coachingArea as CoachingArea, observedIssueRegions: item.observedIssueRegions as AnatomyRegion[] };
  });
  const nextSetPlan = exactProblemOrder(result.nextSetPlan, problems, "nextSetPlan").map((item, index) => ({ problemId: problems[index].id, action: text(item.action, "action"), rationale: text(item.rationale, "rationale"), successCheck: text(item.successCheck, "successCheck") }));
  const summary = record(result.setSummary, "setSummary");
  const score = movementScores.length === 0
    ? null
    : Math.round((movementScores.reduce((sum, item) => sum + item.score, 0) / movementScores.length) * 10) / 10;
  return { overallAssessment: text(result.overallAssessment, "overallAssessment"), coachNote: text(result.coachNote, "coachNote"), score, movementScores, muscleFocus: parseMuscleFocus(result.muscleFocus), corrections, setSummary: { verdict: text(summary.verdict, "setSummary.verdict") }, nextSetPlan };
}
