import { z } from "zod";

const catalogExerciseSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  family: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  mechanics: z.record(z.string(), z.unknown()).default({}),
  execution_style: z.string().nullable().optional(),
  matched_terms: z.array(z.string()).optional(),
});

const catalogSchema = z.array(catalogExerciseSchema);

export type CatalogExercise = z.infer<typeof catalogExerciseSchema>;

type CatalogLoader = (query: string, limit: number) => Promise<{
  data: unknown;
  error: { message: string } | null;
}>;

async function defaultSearchCatalog(query: string, limit: number): Promise<{ data: unknown; error: { message: string } | null }> {
  try {
    const { supabase } = await import("@/lib/supabase");
    const response = await supabase.rpc("search_exercise_variants_v2", {
      p_query: query,
      p_limit: limit,
    });
    return {
      data: response.data,
      error: response.error ? { message: response.error.message } : null,
    };
  } catch (error) {
    return { data: null, error: { message: error instanceof Error ? error.message : "Exercise catalog request failed" } };
  }
}

export function normalizeExerciseSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const QUERY_EXPANSIONS: Record<string, readonly string[]> = {
  db: ["dumbbell"],
  dbs: ["dumbbell"],
  dumbells: ["dumbbell"],
  dumbell: ["dumbbell"],
  bb: ["barbell"],
  bbs: ["barbell"],
  one: ["single"],
  single: ["one"],
  hand: ["arm"],
  arm: ["hand"],
  tricep: ["triceps"],
  pulldown: ["pull down", "pulldown"],
  pulldowns: ["pull down", "pulldown"],
};

const SEARCH_STOP_WORDS = new Set(["a", "an", "and", "for", "the", "to", "with", "of"]);

function singularize(token: string): string {
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 4 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

function expandQuery(value: string): string {
  return normalizeExerciseSearch(value)
    .replace(/\bbulgarian squat\b/g, "rear foot elevated split squat")
    .replace(/\bone hand\b/g, "single arm")
    .replace(/\bone arm\b/g, "single arm")
    .replace(/\bsmiths\b/g, "smith");
}

function queryGroups(value: string): string[][] {
  return expandQuery(value)
    .split(" ")
    .filter((token) => token.length > 0 && !SEARCH_STOP_WORDS.has(token))
    .map((token) => [token, singularize(token), ...(QUERY_EXPANSIONS[token] ?? [])].filter((item, index, all) => all.indexOf(item) === index));
}

export function exerciseSearchHighlightTerms(value: string): string[] {
  return [...new Set(queryGroups(value).flatMap((group) => group.filter((term) => term.length > 1)))];
}

function candidateTokens(exercise: CatalogExercise): string[] {
  const mechanicsText = Object.values(exercise.mechanics)
    .flatMap((value) => typeof value === "string" ? [value] : Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  return normalizeExerciseSearch([
    exercise.name,
    ...exercise.aliases,
    exercise.family,
    ...mechanicsText,
  ].join(" ")).split(" ").filter(Boolean);
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0]!;
    previous[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const above = previous[column]!;
      previous[column] = left[row - 1] === right[column - 1]
        ? diagonal
        : Math.min(diagonal + 1, previous[column - 1]! + 1, above + 1);
      diagonal = above;
    }
  }
  return previous[right.length]!;
}

function tokenMatches(group: string[], candidates: string[]): boolean {
  return group.some((token) => candidates.some((candidate) => (
    candidate === token
    || candidate.startsWith(token)
    || (token.length >= 4 && candidate.length >= 4 && editDistance(token, candidate) <= 1)
  )));
}

/**
 * The RPC owns ranking. This client-side check is deliberately only a
 * credibility gate: it prevents an invalid/stale backend response from
 * offering an unrelated exercise or a result missing a meaningful token.
 */
function isCredibleSearchResult(exercise: CatalogExercise, query: string): boolean {
  const groups = queryGroups(query);
  if (groups.length === 0) return false;
  // `matched_terms` is useful evidence from the RPC, but it is not a license
  // to bypass the token gate. A stale or malformed response must still prove
  // that every meaningful query group maps to the returned row.
  const candidates = [
    ...candidateTokens(exercise),
    ...(exercise.matched_terms ?? []).flatMap((term) => normalizeExerciseSearch(term).split(" ")),
  ];
  return groups.every((group) => tokenMatches(group, candidates));
}

export async function searchExerciseCatalog(query: string, loadCatalog: CatalogLoader = defaultSearchCatalog): Promise<CatalogExercise[]> {
  const normalized = normalizeExerciseSearch(query);
  if (!normalized || queryGroups(normalized).length === 0) return [];
  const { data, error } = await loadCatalog(normalized, 20);
  if (error) throw new Error(error.message);
  const parsed = catalogSchema.parse(data ?? []).slice(0, 20);
  return parsed.filter((exercise) => isCredibleSearchResult(exercise, normalized));
}

export function exerciseIsUnilateral(exercise: CatalogExercise | null, label: string): boolean {
  const laterality = exercise?.mechanics.laterality;
  if (laterality === "unilateral" || laterality === "alternating") return true;
  return /\b(one[- ]arm|one[- ]leg|single[- ]arm|single[- ]leg|unilateral|split squat|lunge)\b/i.test(label);
}
