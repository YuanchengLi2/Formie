import { z } from "zod";

export const setStyleSchema = z.enum([
  "paused",
  "slow_tempo",
  "partial_range",
  "assisted",
  "to_failure",
]);

const exerciseSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("catalog"),
    catalogExerciseId: z.number({ message: "Catalog exercise requires a catalog exercise ID" }).int().positive(),
    label: z.string().trim().min(2).max(120),
  }),
  z.object({
    source: z.literal("custom"),
    catalogExerciseId: z.null({ message: "Custom exercise must not include a catalog exercise ID" }),
    label: z.string().trim().min(2).max(120),
  }),
]);

const amountSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("reps"),
    value: z.number().int().min(1, "Amount must be at least one rep").max(999),
    countScope: z.enum(["total", "per_side"], { message: "Rep amount requires total or per-side counting" }),
  }),
  z.object({
    kind: z.literal("seconds"),
    value: z.number().int().min(1, "Amount must be at least one second").max(3600),
    countScope: z.null({ message: "Timed amount cannot use a rep-count scope" }),
  }),
]);

const loadSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("bodyweight") }),
  z.object({ kind: z.literal("unknown") }),
  z.object({
    kind: z.literal("known"),
    value: z.number().positive("Load must be greater than zero").max(10_000),
    unit: z.enum(["lb", "kg"]),
    scope: z.enum(["per_hand", "total", "machine"]),
  }),
]);

export const setDeclarationSchema = z.object({
  exercise: exerciseSchema,
  amount: amountSchema,
  load: loadSchema,
  side: z.enum(["left", "right", "bilateral", "alternating"]).nullable(),
  styles: z.array(setStyleSchema).max(5).refine(
    (styles) => new Set(styles).size === styles.length,
    "Each intentional style can only be selected once",
  ),
  focusNote: z.string().trim().min(1).max(280).nullable(),
}).strict();

export type SetDeclaration = z.infer<typeof setDeclarationSchema>;
export type SetStyle = z.infer<typeof setStyleSchema>;

export function parseSetDeclaration(value: unknown): SetDeclaration {
  const parsed = setDeclarationSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Set declaration is invalid");
  }
  return parsed.data;
}
