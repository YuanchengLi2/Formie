import { z } from "zod";

const catalogExerciseSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  family: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  mechanics: z.record(z.string(), z.unknown()),
});

const catalogSchema = z.array(catalogExerciseSchema).max(1000);

export type CatalogExercise = z.infer<typeof catalogExerciseSchema>;

type CatalogLoader = () => Promise<{
  data: unknown;
  error: { message: string } | null;
}>;

let cachedCatalog: CatalogExercise[] | null = null;
let pendingCatalog: Promise<CatalogExercise[]> | null = null;

async function defaultLoadCatalog(): Promise<{ data: unknown; error: { message: string } | null }> {
  if (cachedCatalog) return { data: cachedCatalog, error: null };
  if (!pendingCatalog) {
    pendingCatalog = (async () => {
      const { supabase } = await import("@/lib/supabase");
      const response = await supabase
        .from("exercise_variants_v2")
        .select("id,name,family,aliases,mechanics")
        .eq("is_active", true)
        .order("name", { ascending: true })
        .limit(1000);
      if (response.error) throw new Error(response.error.message);
      return catalogSchema.parse(response.data ?? []);
    })();
  }

  try {
    cachedCatalog = await pendingCatalog;
    return { data: cachedCatalog, error: null };
  } catch (error) {
    return { data: null, error: { message: error instanceof Error ? error.message : "Exercise catalog request failed" } };
  } finally {
    pendingCatalog = null;
  }
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function matchRank(exercise: CatalogExercise, query: string): number | null {
  const name = normalize(exercise.name);
  const aliases = exercise.aliases.map(normalize);
  if (name === query) return 0;
  if (aliases.includes(query)) return 1;
  if (name.startsWith(query)) return 2;
  if (aliases.some((alias) => alias.startsWith(query))) return 3;
  if (name.includes(query)) return 4;
  if (aliases.some((alias) => alias.includes(query))) return 5;

  const tokens = query.split(" ").filter(Boolean);
  const searchable = [name, ...aliases].join(" ");
  return tokens.length > 0 && tokens.every((token) => searchable.includes(token)) ? 6 : null;
}

export async function searchExerciseCatalog(query: string, loadCatalog: CatalogLoader = defaultLoadCatalog): Promise<CatalogExercise[]> {
  const normalized = normalize(query);
  if (!normalized) return [];
  const { data, error } = await loadCatalog();
  if (error) throw new Error(error.message);
  const catalog = catalogSchema.parse(data ?? []);

  return catalog
    .map((exercise) => ({ exercise, rank: matchRank(exercise, normalized) }))
    .filter((entry): entry is { exercise: CatalogExercise; rank: number } => entry.rank !== null)
    .sort((left, right) => left.rank - right.rank || left.exercise.name.localeCompare(right.exercise.name))
    .slice(0, 12)
    .map((entry) => entry.exercise);
}

export function exerciseIsUnilateral(exercise: CatalogExercise | null, label: string): boolean {
  const laterality = exercise?.mechanics.laterality;
  if (laterality === "unilateral" || laterality === "alternating") return true;
  return /\b(one[- ]arm|one[- ]leg|single[- ]arm|single[- ]leg|unilateral|split squat|lunge)\b/i.test(label);
}
