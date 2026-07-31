export type CoachLocationScope = "whole_set" | "focused_window" | "insufficient";

export type CoachLocation = {
  scope: CoachLocationScope;
  startMs: number | null;
  endMs: number | null;
  rationale: string;
  clarification: string | null;
};

export type CoachAnswer = {
  directAnswer: string;
  observations: Array<{ offsetMs: number; label: string }>;
  visibilityLimitations: string[];
  nextSetAction: string | null;
};

export type CoachGrounding = {
  scope: CoachLocationScope;
  startMs: number | null;
  endMs: number | null;
  citations: Array<{ timeMs: number; label: string }>;
};

const WINDOW_PADDING_MS = 1_500;
const MAX_WINDOW_MS = 15_000;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: string[]) {
  const extra = Object.keys(value).find((key) => !allowed.includes(key));
  if (extra) throw new Error(`Unexpected ${extra} field`);
}

function requiredText(value: unknown, label: string, max = 4_000): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new Error(`${label} is invalid`);
  return value.trim();
}

function nullableText(value: unknown, label: string): string | null {
  return value === null ? null : requiredText(value, label, 1_000);
}

export function parseCoachLocation(value: unknown): CoachLocation {
  const input = record(value, "Coach location");
  exactKeys(input, ["scope", "startMs", "endMs", "rationale", "clarification"]);
  if (input.scope !== "whole_set" && input.scope !== "focused_window" && input.scope !== "insufficient") throw new Error("Coach location scope is invalid");
  const rationale = requiredText(input.rationale, "Coach location rationale", 1_000);
  const clarification = nullableText(input.clarification, "Coach clarification");
  if (input.scope === "focused_window") {
    if (!Number.isInteger(input.startMs) || !Number.isInteger(input.endMs) || Number(input.startMs) < 0 || Number(input.endMs) <= Number(input.startMs)) throw new Error("Coach location range is invalid");
    if (clarification !== null) throw new Error("Focused location cannot request clarification");
    return { scope: input.scope, startMs: Number(input.startMs), endMs: Number(input.endMs), rationale, clarification: null };
  }
  if (input.startMs !== null || input.endMs !== null) throw new Error(`${input.scope} location cannot include a range`);
  if (input.scope === "whole_set" && clarification !== null) throw new Error("whole_set location cannot request clarification");
  if (input.scope === "insufficient" && clarification === null) throw new Error("insufficient location requires clarification");
  return { scope: input.scope, startMs: null, endMs: null, rationale, clarification };
}

export function normalizeCoachLocation(location: CoachLocation, durationMs: number): CoachLocation {
  if (!Number.isInteger(durationMs) || durationMs <= 0) throw new Error("Video duration is invalid");
  if (location.scope !== "focused_window") return location;
  if (location.startMs === null || location.endMs === null || location.endMs > durationMs) throw new Error("Coach location range exceeds the video duration");
  let startMs = Math.max(0, location.startMs - WINDOW_PADDING_MS);
  let endMs = Math.min(durationMs, location.endMs + WINDOW_PADDING_MS);
  if (endMs - startMs > MAX_WINDOW_MS) {
    const center = (location.startMs + location.endMs) / 2;
    startMs = Math.max(0, Math.round(center - MAX_WINDOW_MS / 2));
    endMs = Math.min(durationMs, startMs + MAX_WINDOW_MS);
    startMs = Math.max(0, endMs - MAX_WINDOW_MS);
  }
  return { ...location, startMs, endMs };
}

export function parseCoachAnswer(value: unknown, reviewedDurationMs: number): CoachAnswer {
  const input = record(value, "Coach answer");
  exactKeys(input, ["directAnswer", "observations", "visibilityLimitations", "nextSetAction"]);
  if (!Number.isInteger(reviewedDurationMs) || reviewedDurationMs <= 0) throw new Error("Reviewed duration is invalid");
  if (!Array.isArray(input.observations) || input.observations.length > 8) throw new Error("Coach observations are invalid");
  const observations = input.observations.map((item) => {
    const observation = record(item, "Coach observation");
    exactKeys(observation, ["offsetMs", "label"]);
    if (!Number.isInteger(observation.offsetMs) || Number(observation.offsetMs) < 0 || Number(observation.offsetMs) > reviewedDurationMs) throw new Error("Coach citation is outside the reviewed media");
    return { offsetMs: Number(observation.offsetMs), label: requiredText(observation.label, "Coach observation label", 500) };
  });
  if (!Array.isArray(input.visibilityLimitations) || input.visibilityLimitations.length > 6) throw new Error("Coach visibility limitations are invalid");
  const visibilityLimitations = input.visibilityLimitations.map((item) => requiredText(item, "Coach visibility limitation", 500));
  return {
    directAnswer: requiredText(input.directAnswer, "Coach direct answer"),
    observations,
    visibilityLimitations,
    nextSetAction: nullableText(input.nextSetAction, "Coach next-set action"),
  };
}

export function buildCoachGrounding(location: CoachLocation, answer: CoachAnswer, durationMs: number): CoachGrounding {
  const startMs = location.scope === "focused_window" ? location.startMs : location.scope === "whole_set" ? 0 : null;
  const endMs = location.scope === "focused_window" ? location.endMs : location.scope === "whole_set" ? durationMs : null;
  const baseMs = startMs ?? 0;
  const citations = answer.observations.map((item) => ({ timeMs: baseMs + item.offsetMs, label: item.label }));
  if (citations.some((item) => item.timeMs < 0 || item.timeMs > durationMs || (endMs !== null && item.timeMs > endMs))) throw new Error("Coach citation is outside the original video");
  return { scope: location.scope, startMs, endMs, citations };
}

function timestamp(milliseconds: number): string {
  const totalTenths = Math.max(0, Math.round(milliseconds / 100));
  const minutes = Math.floor(totalTenths / 600);
  const seconds = (totalTenths % 600) / 10;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toFixed(1).padStart(4, "0")}`;
}

export function renderCoachAnswer(answer: CoachAnswer, grounding: CoachGrounding): string {
  const sections = [answer.directAnswer];
  if (grounding.citations.length) sections.push(grounding.citations.map((item) => `${timestamp(item.timeMs)} — ${item.label}`).join("\n"));
  if (answer.visibilityLimitations.length) sections.push(`Visibility: ${answer.visibilityLimitations.join(" ")}`);
  if (answer.nextSetAction) sections.push(`Next set: ${answer.nextSetAction}`);
  return sections.join("\n\n");
}

export const COACH_LOCATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["scope", "startMs", "endMs", "rationale", "clarification"],
  properties: {
    scope: { type: "string", enum: ["whole_set", "focused_window", "insufficient"] },
    startMs: { type: ["integer", "null"], description: "Original-video start in ms for focused_window only; otherwise null." },
    endMs: { type: ["integer", "null"], description: "Original-video end in ms for focused_window only; otherwise null." },
    rationale: { type: "string" },
    clarification: { type: ["string", "null"], description: "Required only for insufficient; otherwise null." },
  },
} as const;

export const COACH_ANSWER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["directAnswer", "observations", "visibilityLimitations", "nextSetAction"],
  properties: {
    directAnswer: { type: "string" },
    observations: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false, required: ["offsetMs", "label"], properties: { offsetMs: { type: "integer", description: "Milliseconds from the first frame of the supplied reviewed media, never the original-video timeline for a clip." }, label: { type: "string" } } } },
    visibilityLimitations: { type: "array", maxItems: 6, items: { type: "string" } },
    nextSetAction: { type: ["string", "null"] },
  },
} as const;
