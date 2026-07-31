export type SetDeclaration = {
  exercise:
    | { source: "catalog"; catalogExerciseId: number; label: string }
    | { source: "custom"; catalogExerciseId: null; label: string };
  amount:
    | { kind: "reps"; value: number; countScope: "total" | "per_side" | null }
    | { kind: "seconds"; value: number; countScope: null };
  load:
    | { kind: "bodyweight" }
    | { kind: "unknown" }
    | { kind: "known"; value: number; unit: "lb" | "kg"; scope: "per_hand" | "total" | "machine" };
  side: "left" | "right" | "bilateral" | "alternating" | null;
  styles: Array<"paused" | "slow_tempo" | "partial_range" | "assisted" | "to_failure">;
  focusNote: string | null;
};

const SIDES = new Set(["left", "right", "bilateral", "alternating"]);
const STYLES = new Set(["paused", "slow_tempo", "partial_range", "assisted", "to_failure"]);
const LOAD_SCOPES = new Set(["per_hand", "total", "machine"]);

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: string[], name: string) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw new Error(`${name} contains an unexpected property`);
}

function requiredText(value: unknown, name: string, max = 120): string {
  if (typeof value !== "string" || value.trim().length < 2 || value.trim().length > max) {
    throw new Error(`${name} is invalid`);
  }
  return value.trim();
}

function positiveInteger(value: unknown, name: string, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > max) {
    throw new Error(`${name} is invalid`);
  }
  return value;
}

export function parseSetDeclaration(value: unknown): SetDeclaration {
  const declaration = record(value, "set declaration");
  exactKeys(declaration, ["exercise", "amount", "load", "side", "styles", "focusNote"], "set declaration");

  const exercise = record(declaration.exercise, "exercise");
  exactKeys(exercise, ["source", "catalogExerciseId", "label"], "exercise");
  const label = requiredText(exercise.label, "exercise label");
  let parsedExercise: SetDeclaration["exercise"];
  if (exercise.source === "catalog") {
    parsedExercise = {
      source: "catalog",
      catalogExerciseId: positiveInteger(exercise.catalogExerciseId, "catalog exercise ID", Number.MAX_SAFE_INTEGER),
      label,
    };
  } else if (exercise.source === "custom") {
    if (exercise.catalogExerciseId !== null) throw new Error("Custom exercise must not include a catalog exercise ID");
    parsedExercise = { source: "custom", catalogExerciseId: null, label };
  } else {
    throw new Error("Exercise source is invalid");
  }

  const amount = record(declaration.amount, "amount");
  exactKeys(amount, ["kind", "value", "countScope"], "amount");
  let parsedAmount: SetDeclaration["amount"];
  if (amount.kind === "reps") {
    if (amount.countScope !== "total" && amount.countScope !== "per_side") {
      throw new Error("Rep amount count scope is invalid");
    }
    parsedAmount = {
      kind: "reps",
      value: positiveInteger(amount.value, "amount", 999),
      countScope: amount.countScope,
    };
  } else if (amount.kind === "seconds") {
    if (amount.countScope !== null) throw new Error("Timed amount cannot use a rep-count scope");
    parsedAmount = { kind: "seconds", value: positiveInteger(amount.value, "amount", 3600), countScope: null };
  } else {
    throw new Error("Amount kind is invalid");
  }

  const load = record(declaration.load, "load");
  let parsedLoad: SetDeclaration["load"];
  if (load.kind === "bodyweight" || load.kind === "unknown") {
    exactKeys(load, ["kind"], "load");
    parsedLoad = { kind: load.kind };
  } else if (load.kind === "known") {
    exactKeys(load, ["kind", "value", "unit", "scope"], "load");
    if (
      typeof load.value !== "number" ||
      !Number.isFinite(load.value) ||
      load.value <= 0 ||
      load.value > 10_000 ||
      (load.unit !== "lb" && load.unit !== "kg") ||
      typeof load.scope !== "string" ||
      !LOAD_SCOPES.has(load.scope)
    ) throw new Error("Known load is invalid");
    parsedLoad = {
      kind: "known",
      value: load.value,
      unit: load.unit,
      scope: load.scope as "per_hand" | "total" | "machine",
    };
  } else {
    throw new Error("Load kind is invalid");
  }

  if (declaration.side !== null && (typeof declaration.side !== "string" || !SIDES.has(declaration.side))) {
    throw new Error("Side is invalid");
  }
  if (
    !Array.isArray(declaration.styles) ||
    declaration.styles.some((style) => typeof style !== "string" || !STYLES.has(style)) ||
    new Set(declaration.styles).size !== declaration.styles.length
  ) throw new Error("Intentional style selection is invalid");
  if (
    declaration.focusNote !== null &&
    (typeof declaration.focusNote !== "string" || declaration.focusNote.trim().length < 1 || declaration.focusNote.trim().length > 280)
  ) throw new Error("Focus note is invalid");

  return {
    exercise: parsedExercise,
    amount: parsedAmount,
    load: parsedLoad,
    side: declaration.side as SetDeclaration["side"],
    styles: declaration.styles as SetDeclaration["styles"],
    focusNote: declaration.focusNote === null ? null : declaration.focusNote.trim(),
  };
}
