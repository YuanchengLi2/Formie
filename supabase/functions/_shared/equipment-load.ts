export type EquipmentLoad = {
  value: number | null;
  unit: "kg" | "lb" | null;
  scope: string | null;
  certainty: "exact_visible" | "partial_visible" | "unknown";
  basis: "readable_label" | "readable_selector" | "counted_visible_plates" | "not_readable";
};

export type EquipmentLoadContext = {
  category?: unknown;
  title?: unknown;
  observation?: unknown;
};

function finiteNonnegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function scopeValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizeEquipmentLoad(value: unknown, context: EquipmentLoadContext = {}): EquipmentLoad | null {
  const contextText = [context.title, context.observation]
    .filter((item): item is string => typeof item === "string")
    .join(" ")
    .toLowerCase();
  if (
    (typeof context.category === "string" && context.category !== "visible_load")
    || /\bbody[\s-]?weight\b/.test(contextText)
    || /\bno external (?:load|weight|implement|equipment)\b/.test(contextText)
  ) {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const load = value as Record<string, unknown>;
  const scope = scopeValue(load.scope);
  const unit = load.unit === "kg" || load.unit === "lb" ? load.unit : null;
  const numericValue = finiteNonnegative(load.value) ? load.value : null;

  if (scope?.toLowerCase() === "bodyweight") return null;

  if (
    load.certainty === "exact_visible"
    && numericValue !== null
    && unit !== null
    && scope !== null
    && (load.basis === "readable_label" || load.basis === "readable_selector")
  ) {
    return { value: numericValue, unit, scope, certainty: "exact_visible", basis: load.basis };
  }

  if (
    load.certainty === "partial_visible"
    && load.basis === "counted_visible_plates"
    && ((numericValue === null && unit === null) || (numericValue !== null && unit !== null))
  ) {
    return { value: numericValue, unit, scope, certainty: "partial_visible", basis: "counted_visible_plates" };
  }

  if (load.basis === "not_readable" && numericValue === null && unit === null) {
    return { value: null, unit: null, scope, certainty: "unknown", basis: "not_readable" };
  }

  return null;
}
