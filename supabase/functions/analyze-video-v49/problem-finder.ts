import type { SetDeclaration } from "../_shared/set-declaration.ts";

type JsonRecord = Record<string, unknown>;

export type ProblemEvidence = {
  startMs: number;
  peakMs: number;
  endMs: number;
  visualEvidence: string;
  confidence: number;
};

export type ProblemFinderProblem = {
  id: string;
  observation: string;
  evidence: ProblemEvidence[];
};

export type UnableReason = {
  code: "video_unreadable" | "movement_not_visible" | "insufficient_visual_evidence" | "other";
  message: string;
};

export type ProblemFinderResult =
  | { status: "complete"; unableReason: null; problems: ProblemFinderProblem[] }
  | { status: "unable"; unableReason: UnableReason; problems: [] };

const UNABLE_CODES = new Set<UnableReason["code"]>(["video_unreadable", "movement_not_visible", "insufficient_visual_evidence", "other"]);

function record(value: unknown, name: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as JsonRecord;
}

function exactKeys(value: JsonRecord, allowed: string[], name: string): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw new Error(`${name} contains an unexpected property`);
}

function text(value: unknown, name: string, max = 1_000): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new Error(`${name} must be non-empty text`);
  return value.trim();
}

function finite(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  return value;
}

function normalizedObservation(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function substantiveText(value: unknown, name: string): string {
  const parsed = text(value, name);
  const words = normalizedObservation(parsed).split(" ").filter(Boolean);
  const generic = /^(?:visible\s+)?(?:problem|issue|form|technique|movement)(?:\s+number)?\b/i.test(parsed)
    || /\b(?:problem|issue)\s+(?:is\s+)?visible(?:\s+in\s+the\s+(?:video|recording))?\.?$/i.test(parsed);
  if (words.length < 4 || generic) throw new Error(`${name} must be substantive visible evidence`);
  return parsed;
}

function declarationContext(declaration: SetDeclaration): string {
  const amount = declaration.amount.kind === "reps"
    ? `${declaration.amount.value} repetitions${declaration.amount.countScope === "per_side" ? " per side" : " total"}`
    : `${declaration.amount.value} seconds`;
  const load = declaration.load.kind === "known"
    ? `${declaration.load.value} ${declaration.load.unit} ${declaration.load.scope.replaceAll("_", " ")}`
    : declaration.load.kind;
  return JSON.stringify({
    exercise: declaration.exercise.label,
    amount,
    load,
    side: declaration.side,
    intentionalStyles: declaration.styles,
    userNote: declaration.focusNote,
  });
}

export function buildProblemFinderPrompt(durationMs: number, declaration: SetDeclaration): string {
  return `Watch the complete ${durationMs} ms exercise recording from beginning, middle, and end. Your only job is to identify visible problems in the declared exercise. Inspect the movement broadly and exercise-specifically: equipment setup and body-to-equipment contact; posture and joint alignment; grip and other contact points; movement and equipment path; usable range and endpoints; tempo, control, and momentum; balance, support, stability, and left-right symmetry; changes across repetitions; and any other visible issue relevant to this exercise. These are inspection directions, not required output categories. Report only distinct problems that are genuinely visible; do not invent one merely to cover a category. Return at least four distinct genuine visible problems. Four is a minimum, never a stopping target. Continue beyond four when more genuine problems are visible. Do not stop after the first obvious problem; rank all findings by importance. Do not combine distinct problems or restate the same observation with different wording. Do not omit a visible problem because it is subtle or intermittent; use appropriate confidence. Every problem must state a specific body, equipment, position, path, or timing relationship and must be supported by specific visible evidence with timestamps. If fewer than four genuine distinct problems can be supported, return unable with insufficient_visual_evidence rather than padding the result with vague, duplicated, or invented issues. Return unable for unreadable or out-of-frame movement as appropriate. The declaration is identification context, not a target or a claim about what occurred; do not judge whether its amount, load, side, styles, or note was followed: ${declarationContext(declaration)}. Return only matching JSON.`;
}

const problemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "observation", "evidence"],
  properties: {
    id: { type: "string" },
    observation: { type: "string" },
    evidence: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["startMs", "peakMs", "endMs", "visualEvidence", "confidence"],
        properties: {
          startMs: { type: "integer", minimum: 0 },
          peakMs: { type: "integer", minimum: 0 },
          endMs: { type: "integer", minimum: 1 },
          visualEvidence: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
    },
  },
} as const;

const unableReasonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["code", "message"],
  properties: {
    code: { type: "string", enum: [...UNABLE_CODES] },
    message: { type: "string" },
  },
} as const;

export const PROBLEM_FINDER_SCHEMA = {
  anyOf: [{
    type: "object",
    additionalProperties: false,
    required: ["status", "unableReason", "problems"],
    properties: {
      status: { type: "string", enum: ["complete"] },
      unableReason: { type: "null" },
      problems: { type: "array", minItems: 4, items: problemSchema },
    },
  }, {
    type: "object",
    additionalProperties: false,
    required: ["status", "unableReason", "problems"],
    properties: {
      status: { type: "string", enum: ["unable"] },
      unableReason: unableReasonSchema,
      problems: { type: "array", maxItems: 0, items: problemSchema },
    },
  }],
} as const;

export function parseProblemFinderResult(value: unknown, durationMs: number): ProblemFinderResult {
  const result = record(value, "problem finder result");
  exactKeys(result, ["status", "unableReason", "problems"], "problem finder result");
  if (!Array.isArray(result.problems)) throw new Error("problems must be an array");
  if (result.status === "unable") {
    if (result.problems.length !== 0) throw new Error("unable results cannot contain problems");
    const reason = record(result.unableReason, "unableReason");
    exactKeys(reason, ["code", "message"], "unableReason");
    if (typeof reason.code !== "string" || !UNABLE_CODES.has(reason.code as UnableReason["code"])) throw new Error("unableReason.code is invalid");
    return { status: "unable", unableReason: { code: reason.code as UnableReason["code"], message: text(reason.message, "unableReason.message", 500) }, problems: [] };
  }
  if (result.status !== "complete" || result.unableReason !== null) throw new Error("complete results require a null unableReason");
  if (result.problems.length < 4) throw new Error("complete results require at least four problems");
  const ids = new Set<string>();
  const observations = new Set<string>();
  const problems = result.problems.map((raw, problemIndex) => {
    const problem = record(raw, `problems[${problemIndex}]`);
    exactKeys(problem, ["id", "observation", "evidence"], `problems[${problemIndex}]`);
    const id = text(problem.id, `problems[${problemIndex}].id`, 120);
    if (ids.has(id)) throw new Error(`duplicate problem id: ${id}`);
    ids.add(id);
    if (!Array.isArray(problem.evidence) || problem.evidence.length === 0) throw new Error(`problems[${problemIndex}].evidence must contain at least one moment`);
    const evidence = problem.evidence.map((rawMoment, evidenceIndex) => {
      const moment = record(rawMoment, `problems[${problemIndex}].evidence[${evidenceIndex}]`);
      exactKeys(moment, ["startMs", "peakMs", "endMs", "visualEvidence", "confidence"], `problems[${problemIndex}].evidence[${evidenceIndex}]`);
      const startMs = finite(moment.startMs, "startMs");
      const peakMs = finite(moment.peakMs, "peakMs");
      const endMs = finite(moment.endMs, "endMs");
      const confidence = finite(moment.confidence, "confidence");
      if (!Number.isInteger(startMs) || !Number.isInteger(peakMs) || !Number.isInteger(endMs) || startMs < 0 || startMs > peakMs || peakMs > endMs || endMs > durationMs) throw new Error("problem evidence timestamps are invalid");
      if (confidence < 0 || confidence > 1) throw new Error("problem evidence confidence is invalid");
      return { startMs, peakMs, endMs, visualEvidence: substantiveText(moment.visualEvidence, "visualEvidence"), confidence };
    });
    const observation = substantiveText(problem.observation, `problems[${problemIndex}].observation`);
    const normalized = normalizedObservation(observation);
    if (observations.has(normalized)) throw new Error(`duplicate problem observation: ${observation}`);
    observations.add(normalized);
    return { id, observation, evidence };
  });
  return { status: "complete", unableReason: null, problems };
}
