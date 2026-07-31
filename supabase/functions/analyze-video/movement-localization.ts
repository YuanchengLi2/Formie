export type MovementLocalization = {
  outcome: "movement_found" | "no_movement";
  activeSetStartMs: number | null;
  activeSetEndMs: number | null;
  repetitions: Array<{
    startMs: number;
    peakMs: number;
    endMs: number;
    observation: string;
  }>;
  movementEvidence: string[];
};

export const MOVEMENT_LOCALIZATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["outcome", "activeSetStartMs", "activeSetEndMs", "repetitions", "movementEvidence"],
  properties: {
    outcome: { type: "string", enum: ["movement_found", "no_movement"] },
    activeSetStartMs: { type: ["integer", "null"], minimum: 0 },
    activeSetEndMs: { type: ["integer", "null"], minimum: 1 },
    repetitions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["startMs", "peakMs", "endMs", "observation"],
        properties: {
          startMs: { type: "integer", minimum: 0 },
          peakMs: { type: "integer", minimum: 0 },
          endMs: { type: "integer", minimum: 1 },
          observation: { type: "string" },
        },
      },
    },
    movementEvidence: { type: "array", items: { type: "string" } },
  },
} as const;

function integer(value: unknown, name: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new Error(`${name} is outside the recording`);
  }
  return value as number;
}

export function parseMovementLocalization(value: unknown, durationMs: number): MovementLocalization {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Movement localization must be an object");
  const record = value as Record<string, unknown>;
  const allowed = ["outcome", "activeSetStartMs", "activeSetEndMs", "repetitions", "movementEvidence"];
  if (Object.keys(record).some((key) => !allowed.includes(key))) throw new Error("Movement localization contains unsupported fields");
  if (record.outcome !== "movement_found" && record.outcome !== "no_movement") throw new Error("Movement localization outcome is invalid");
  if (!Array.isArray(record.repetitions)) throw new Error("Movement localization repetitions must be an array");
  if (!Array.isArray(record.movementEvidence) || record.movementEvidence.some((item) => typeof item !== "string")) {
    throw new Error("Movement localization evidence must be text");
  }
  const repetitions = record.repetitions.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Repetition ${index + 1} is invalid`);
    const repetition = value as Record<string, unknown>;
    const startMs = integer(repetition.startMs, `Repetition ${index + 1} start`, 0, Math.max(0, durationMs - 1));
    const peakMs = integer(repetition.peakMs, `Repetition ${index + 1} peak`, startMs, durationMs);
    const endMs = integer(repetition.endMs, `Repetition ${index + 1} end`, peakMs, durationMs);
    if (startMs >= peakMs || peakMs >= endMs || typeof repetition.observation !== "string" || !repetition.observation.trim()) {
      throw new Error(`Repetition ${index + 1} must have one ordered movement cycle`);
    }
    return { startMs, peakMs, endMs, observation: repetition.observation.trim() };
  }).sort((left, right) => left.startMs - right.startMs);
  if (repetitions.some((repetition, index) => index > 0 && repetition.startMs < repetitions[index - 1].endMs)) {
    throw new Error("Movement localization repetitions overlap");
  }
  if (record.outcome === "no_movement") {
    if (record.activeSetStartMs !== null || record.activeSetEndMs !== null || repetitions.length > 0) {
      throw new Error("A no-movement result cannot contain repetition windows");
    }
    return {
      outcome: "no_movement",
      activeSetStartMs: null,
      activeSetEndMs: null,
      repetitions: [],
      movementEvidence: record.movementEvidence as string[],
    };
  }
  const activeSetStartMs = integer(record.activeSetStartMs, "Active-set start", 0, Math.max(0, durationMs - 1));
  const activeSetEndMs = integer(record.activeSetEndMs, "Active-set end", activeSetStartMs + 1, durationMs);
  if (repetitions.some((repetition) => repetition.startMs < activeSetStartMs || repetition.endMs > activeSetEndMs)) {
    throw new Error("Repetition windows must stay inside the active set");
  }
  return {
    outcome: "movement_found",
    activeSetStartMs,
    activeSetEndMs,
    repetitions,
    movementEvidence: record.movementEvidence as string[],
  };
}

export function buildMovementLocalizationPrompt(durationMs: number, exerciseLabel: string, declaredReps: number | null): string {
  return `Your only task is to locate the active exercise movement in a mobile gym video. Watch the complete ${durationMs} ms recording in chronological order.
The declared exercise is ${exerciseLabel}.${declaredReps ? ` The user declared ${declaredReps} repetitions.` : ""}
Separate setup and post-set actions from the exercise. Track repeated displacement of the working joints, hands, and hand-held weight relative to the bench, torso, and other fixed references. A repetition is one path away from a start position and back toward it.
Return movement_found whenever meaningful exercise motion is visible, even if framing is limited or the set is short. For each visible repetition, provide its full start, reversal peak, and end window. Return no_movement only when the complete recording contains no analyzable exercise motion.`;
}

export function movementLocalizationAnchor(localization: MovementLocalization): string {
  if (localization.outcome === "no_movement") return "The dedicated temporal pass found no exercise movement.";
  const repetitions = localization.repetitions
    .map((repetition, index) => `rep ${index + 1}: ${repetition.startMs}-${repetition.endMs} ms (peak ${repetition.peakMs} ms)`)
    .join("; ");
  return `The dedicated temporal pass located active exercise movement from ${localization.activeSetStartMs}-${localization.activeSetEndMs} ms.${repetitions ? ` ${repetitions}.` : ""}`;
}
