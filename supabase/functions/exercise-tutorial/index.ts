import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { createGeminiTutorialClient, type TutorialVideo } from "../_shared/gemini-tutorial.ts";
import { exerciseTutorialHandler } from "./handler.ts";

const tutorialClient = createGeminiTutorialClient({
  apiKey: Deno.env.get("GEMINI_API_KEY") ?? "",
  model: Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash",
});

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  const admin = createAdminClient();
  const response = await exerciseTutorialHandler(request, {
    authenticate: (incoming) => requireUserId(incoming, admin),
    loadSession: async (sessionId, userId) => {
      const { data, error } = await admin
        .from("analysis_sessions")
        .select("id,status,detected_label,corrected_label,tutorial_video")
        .eq("id", sessionId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data ? { id: data.id, status: data.status, label: data.corrected_label ?? data.detected_label, tutorial: data.tutorial_video as TutorialVideo | null } : null;
    },
    findTutorial: (label) => tutorialClient.findTutorial(label),
    saveTutorial: async (sessionId, tutorial) => {
      const { error } = await admin.from("analysis_sessions").update({ tutorial_video: tutorial, updated_at: new Date().toISOString() }).eq("id", sessionId);
      if (error) throw error;
    },
  });
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
});
