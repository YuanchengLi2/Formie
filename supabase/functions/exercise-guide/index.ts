import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import {
  buildTextGenerateContentRequest,
  createGenerateContentClient,
} from "../_shared/gemini-generate.ts";
import {
  exerciseGuideHandler,
  parseExerciseGuide,
  type ExerciseGuideSource,
} from "./handler.ts";
import { createGeminiTutorialClient } from "../_shared/gemini-tutorial.ts";

const GUIDE_VERSION = "catalog-guide-v2";
const MODEL = Deno.env.get("EXERCISE_GUIDE_MODEL") ?? "gemini-3.1-flash-lite";
const TUTORIAL_MODEL = Deno.env.get("GEMINI_TUTORIAL_MODEL") ?? "gemini-3.1-flash-lite";
const generation = createGenerateContentClient({
  apiKey: Deno.env.get("GEMINI_API_KEY") ?? "",
});
const tutorialSearch = createGeminiTutorialClient({
  apiKey: Deno.env.get("GEMINI_API_KEY") ?? "",
  model: TUTORIAL_MODEL,
});

const guideSchema = {
  type: "object",
  required: ["family", "setup", "execution", "safety", "cameraPlacement"],
  properties: {
    family: { type: "string", enum: ["curl", "triceps", "press", "overhead-press", "fly", "raise", "row", "pull-down", "squat", "lunge", "hinge", "hip-thrust", "carry", "core", "plank", "other"] },
    setup: { type: "array", items: { type: "string" } },
    execution: { type: "array", items: { type: "string" } },
    safety: { type: "array", items: { type: "string" } },
    cameraPlacement: { type: "array", items: { type: "string" } },
  },
};

function guidePrompt(exercise: ExerciseGuideSource): string {
  return [
    "Create a concise pre-record exercise guide.",
    exercise.id === null
      ? "Use established exercise technique knowledge and do not invent a different variation."
      : "Ground every instruction in the exact canonical exercise mechanics and reviewed criteria below.",
    "Do not diagnose injuries, promise safety, invent equipment, or change the exercise variation.",
    "Return 2-5 setup steps, 3-7 execution steps, and 1-4 practical safety notes.",
    "Classify the movement into exactly one allowed family.",
    "Return 1-3 cameraPlacement tips specifying viewing angle and enough distance to keep the full body and equipment visible.",
    "Each step must be a single direct sentence under 22 words.",
    `Canonical exercise: ${exercise.name}`,
    `Mechanics: ${JSON.stringify(exercise.mechanics)}`,
    `Reviewed criteria: ${JSON.stringify(exercise.criteria)}`,
  ].join("\n");
}

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  const admin = createAdminClient();
  const response = await exerciseGuideHandler(request, {
    authenticate: (incoming) => requireUserId(incoming, admin),
    loadExercise: async (catalogExerciseId) => {
      const [{ data: exercise, error: exerciseError }, { data: criteria, error: criteriaError }, { data: cached, error: cachedError }] = await Promise.all([
        admin
          .from("exercise_variants_v2")
          .select("id,name,family,mechanics")
          .eq("id", catalogExerciseId)
          .eq("is_active", true)
          .maybeSingle(),
        admin
          .from("exercise_criteria_v2")
          .select("phase,visible_good,coaching_cue,specificity")
          .eq("exercise_id", catalogExerciseId)
          .eq("editorial_status", "reviewed")
          .order("id"),
        admin
          .from("exercise_instruction_guides")
          .select("guide")
          .eq("exercise_id", catalogExerciseId)
          .eq("guide_version", GUIDE_VERSION)
          .maybeSingle(),
      ]);
      if (exerciseError) throw exerciseError;
      if (criteriaError) throw criteriaError;
      if (cachedError) throw cachedError;
      if (!exercise) return null;
      return {
        id: exercise.id,
        name: exercise.name,
        family: typeof exercise.family === "string" ? exercise.family : null,
        mechanics: exercise.mechanics as Record<string, unknown>,
        criteria: (criteria ?? []).map((criterion) => ({
          phase: criterion.phase,
          visibleGood: criterion.visible_good,
          coachingCue: criterion.coaching_cue,
          specificity: criterion.specificity,
        })),
        cachedGuide: cached?.guide ? parseExerciseGuide(cached.guide) : null,
      };
    },
    generateGuide: async (exercise) => {
      const response = await generation.generate(
        MODEL,
        buildTextGenerateContentRequest({
          prompt: guidePrompt(exercise),
          schema: guideSchema,
          thinkingLevel: "low",
        }),
      );
      return parseExerciseGuide(response.value);
    },
    saveGuide: async (catalogExerciseId, guide) => {
      const { error } = await admin.from("exercise_instruction_guides").upsert({
        exercise_id: catalogExerciseId,
        guide_version: GUIDE_VERSION,
        guide,
        provider_model: MODEL,
        updated_at: new Date().toISOString(),
      }, { onConflict: "exercise_id,guide_version" });
      if (error) throw error;
    },
    findTutorial: (exerciseName) => tutorialSearch.findTutorial(exerciseName),
  });
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
});
