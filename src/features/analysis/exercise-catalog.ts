import { z } from "zod";

const catalogExerciseSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  family: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  mechanics: z.record(z.string(), z.unknown()),
});

export type CatalogExercise = z.infer<typeof catalogExerciseSchema>;

type CatalogRpc = (
  functionName: "search_exercise_variants",
  parameters: { p_query: string; p_limit: number },
) => Promise<{ data: unknown; error: { message: string } | null }>;

async function defaultRpc(
  functionName: "search_exercise_variants",
  parameters: { p_query: string; p_limit: number },
) {
  const { supabase } = await import("@/lib/supabase");
  const response = await supabase.rpc(functionName, parameters);
  return {
    data: response.data,
    error: response.error ? { message: response.error.message } : null,
  };
}

export async function searchExerciseCatalog(query: string, rpc: CatalogRpc = defaultRpc): Promise<CatalogExercise[]> {
  const normalized = query.trim();
  if (!normalized) return [];
  const { data, error } = await rpc("search_exercise_variants", {
    p_query: normalized,
    p_limit: 12,
  });
  if (error) throw new Error(error.message);
  return z.array(catalogExerciseSchema).max(12).parse(data ?? []);
}

export function exerciseIsUnilateral(exercise: CatalogExercise | null, label: string): boolean {
  const laterality = exercise?.mechanics.laterality;
  if (laterality === "unilateral" || laterality === "alternating") return true;
  return /\b(one[- ]arm|one[- ]leg|single[- ]arm|single[- ]leg|unilateral|split squat|lunge)\b/i.test(label);
}
