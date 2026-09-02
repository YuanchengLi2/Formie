import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { secureBrowserRequest, withCors } from "../_shared/cors.ts";
import { createYouTubeTutorialClient } from "../_shared/youtube-tutorial.ts";
import { resolveYouTubeTutorial } from "../_shared/youtube-tutorial-cache.ts";
import { exerciseTutorialHandler } from "./handler.ts";

const tutorialClient = createYouTubeTutorialClient({ apiKey: Deno.env.get("YOUTUBE_DATA_API_KEY") ?? "" });

Deno.serve(async (request) => {
  const security = await secureBrowserRequest(request, { methods: ["POST"], authentication: "user", maxBodyBytes: 8_192 });
  if (security) return security;
  const admin = createAdminClient();
  const response = await exerciseTutorialHandler(request, {
    authenticate: (incoming) => requireUserId(incoming, admin),
    loadSession: async (sessionId, userId) => {
      const { data, error } = await admin
        .from("analysis_sessions")
        .select("id,status,set_declaration")
        .eq("id", sessionId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const declaration = data.set_declaration && typeof data.set_declaration === "object" ? data.set_declaration as Record<string, unknown> : {};
      const exercise = declaration.exercise && typeof declaration.exercise === "object" ? declaration.exercise as Record<string, unknown> : {};
      return { id: data.id, status: data.status, catalogExerciseId: Number.isInteger(exercise.catalogExerciseId) ? Number(exercise.catalogExerciseId) : null, canonicalLabel: exercise.source === "catalog" && typeof exercise.label === "string" ? exercise.label : null };
    },
    resolveTutorial: (label) => resolveYouTubeTutorial(label, {
      load: async (canonicalExercise) => {
        const { data, error } = await admin.from("youtube_tutorial_cache").select("payload,source_version,verified_at,expires_at").eq("canonical_exercise", canonicalExercise).maybeSingle();
        if (error) throw error;
        return data ? { payload: data.payload, sourceVersion: data.source_version, verifiedAt: data.verified_at, expiresAt: data.expires_at } : null;
      },
      save: async (canonicalExercise, entry) => {
        const { error } = await admin.from("youtube_tutorial_cache").upsert({ canonical_exercise: canonicalExercise, payload: entry.payload, source_version: entry.sourceVersion, verified_at: entry.verifiedAt, expires_at: entry.expiresAt, updated_at: new Date().toISOString() });
        if (error) throw error;
      },
      remove: async (canonicalExercise) => {
        const { error } = await admin.from("youtube_tutorial_cache").delete().eq("canonical_exercise", canonicalExercise);
        if (error) throw error;
      },
      find: (canonicalExercise) => tutorialClient.findTutorial(canonicalExercise),
    }),
  });
  return withCors(request, response);
});
