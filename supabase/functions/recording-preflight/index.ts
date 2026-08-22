import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { secureBrowserRequest, withCors } from "../_shared/cors.ts";
import {
  buildImageGenerateContentRequest,
  createGenerateContentClient,
} from "../_shared/gemini-generate.ts";
import {
  recordingPreflightHandler,
} from "./handler.ts";
import {
  PREFLIGHT_MAX_OUTPUT_TOKENS,
  PREFLIGHT_MEDIA_RESOLUTION,
  PREFLIGHT_PERSPECTIVE_MAX_OUTPUT_TOKENS,
  buildRecordingPreflightAssessmentSchema,
  buildRecordingPreflightPrompt,
  buildRecordingPreflightPerspectivePrompt,
  buildRecordingPreflightPerspectiveSchema,
} from "./contract.ts";
import {
  flattenBlockingVisibilityRequirements,
  resolveVisibilityRequirements,
} from "./visibility-requirements.ts";

const MODEL = Deno.env.get("RECORDING_PREFLIGHT_MODEL") ?? "gemini-3.1-flash-lite";
const generation = createGenerateContentClient({
  apiKey: Deno.env.get("GEMINI_API_KEY") ?? "",
});

Deno.serve(async (request) => {
  const security = await secureBrowserRequest(request, { methods: ["POST"], authentication: "user", maxBodyBytes: 1_048_576 });
  if (security) return security;
  const admin = createAdminClient();
  const response = await recordingPreflightHandler(request, {
    authenticate: (incoming) => requireUserId(incoming, admin),
    resolveVisibilityRequirements: ({ catalogExerciseId, exerciseName }) =>
      resolveVisibilityRequirements({
        catalogExerciseId,
        exerciseName,
        loadCatalogExercise: async (id) => {
          const { data, error } = await admin
            .from("exercise_variants_v2")
            .select("id,name,family,mechanics")
            .eq("id", id)
            .eq("is_active", true)
            .maybeSingle();
          if (error) throw error;
          if (!data) return null;
          return {
            id: Number(data.id),
            name: String(data.name),
            family: String(data.family),
            mechanics: data.mechanics && typeof data.mechanics === "object"
              ? data.mechanics as Record<string, unknown>
              : null,
          };
        },
    }),
    inspectFrames: async ({ frames, durationMs, exerciseName, visibilityRequirements }) => {
      const images = frames.map(({ mimeType, data }) => ({ mimeType, data }));
      const frameTimesMs = frames.map((frame) => frame.timeMs);
      const allowedRequirements =
        flattenBlockingVisibilityRequirements(visibilityRequirements);
      const [readinessResponse, perspectiveResponse] = await Promise.all([
        generation.generate(
          MODEL,
          buildImageGenerateContentRequest({
            images,
            prompt: buildRecordingPreflightPrompt({
              durationMs,
              exerciseName,
              frameTimesMs,
              visibilityRequirements,
            }),
            schema: buildRecordingPreflightAssessmentSchema(
              allowedRequirements,
            ),
            thinkingLevel: "minimal",
            mediaResolution: PREFLIGHT_MEDIA_RESOLUTION,
            maxOutputTokens: PREFLIGHT_MAX_OUTPUT_TOKENS,
            temperature: 0,
          }),
        ),
        generation.generate(
          MODEL,
          buildImageGenerateContentRequest({
            images,
            prompt: buildRecordingPreflightPerspectivePrompt({
              exerciseName,
              frameTimesMs,
              allowedRequirements,
            }),
            schema: buildRecordingPreflightPerspectiveSchema(
              allowedRequirements,
            ),
            thinkingLevel: "minimal",
            mediaResolution: PREFLIGHT_MEDIA_RESOLUTION,
            maxOutputTokens: PREFLIGHT_PERSPECTIVE_MAX_OUTPUT_TOKENS,
            temperature: 0,
          }),
        ),
      ]);
      if (!readinessResponse.value || typeof readinessResponse.value !== "object") {
        throw new Error("INVALID_PREFLIGHT");
      }
      return {
        ...readinessResponse.value as Record<string, unknown>,
        perspectiveAssessment: perspectiveResponse.value,
      };
    },
    recordDecision: async ({
      userId,
      durationMs,
      exerciseName,
      catalogExerciseId,
      decision,
    }) => {
      console.info("recording_preflight_decision", JSON.stringify({
        userId,
        durationMs,
        exerciseName,
        catalogExerciseId,
        ...decision,
      }));
    },
  });
  return withCors(request, response);
});
