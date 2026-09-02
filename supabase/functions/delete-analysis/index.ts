import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { secureBrowserRequest, withCors } from "../_shared/cors.ts";
import { historicalAnalysisArtifactPaths } from "../_shared/legacy-analysis-artifacts.ts";
import { attemptExternalDeletion } from "../_shared/external-deletion.ts";
import { executeProviderDeletion } from "../_shared/provider-deletion.ts";
import { secretEnvelopeKeyFromBase64Url } from "../_shared/secret-envelope.ts";
import { createGeminiFilesClient } from "../_shared/gemini-files.ts";
import { deleteAnalysisHandler } from "./handler.ts";

function required(name: string): string { const value = Deno.env.get(name)?.trim() ?? ""; if (!value) throw new Error(`${name}_MISSING`); return value; }

Deno.serve(async (request) => {
  const security = await secureBrowserRequest(request, { methods: ["DELETE", "POST"], authentication: "user", maxBodyBytes: 4_096 });
  if (security) return security;
  const admin = createAdminClient();
  const envelopeKey = secretEnvelopeKeyFromBase64Url(required("APPLE_TOKEN_ENCRYPTION_KEY"));
  const gemini = createGeminiFilesClient({ apiKey: required("GEMINI_API_KEY") });
  const response = await deleteAnalysisHandler(request, {
    authenticate: (incoming) => requireUserId(incoming, admin),
    findSession: async (sessionId, userId) => {
      const { data: session, error: sessionError } = await admin
        .from("analysis_sessions")
        .select("id,video_path,analysis_video_path,gemini_file_name")
        .eq("id", sessionId)
        .eq("user_id", userId)
        .maybeSingle();
      if (sessionError) throw sessionError;
      if (!session) return null;
      return {
        id: session.id,
        videoPath: session.video_path,
        analysisVideoPath: session.analysis_video_path,
        artifactPaths: historicalAnalysisArtifactPaths(userId, sessionId),
        geminiFileName: session.gemini_file_name,
      };
    },
    deleteGeminiFile: (fileName, userId) => attemptExternalDeletion({ provider: "gemini", operation: "delete_file", payload: { fileName } }, {
      encryptionKey: envelopeKey,
      execute: (current) => executeProviderDeletion(current, { revokeApple: async () => undefined, deleteGeminiFile: (name) => gemini.deleteFile(name), deleteRevenueCatCustomer: async () => undefined }),
      enqueue: async (job) => { const { error } = await admin.from("external_deletion_jobs").upsert({ user_id: userId, provider: job.provider, operation: job.operation, encrypted_payload: job.encryptedPayload, fingerprint: job.fingerprint, status: "pending", next_retry_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "provider,operation,fingerprint" }); if (error) throw error; },
    }),
    removeVideos: async (paths) => {
      const { error } = await admin.storage.from("analysis-videos").remove(paths);
      if (error) throw error;
    },
    deleteSession: async (sessionId, userId) => {
      const { error } = await admin.from("analysis_sessions").delete().eq("id", sessionId).eq("user_id", userId);
      if (error) throw error;
    },
  });

  return withCors(request, response);
});
