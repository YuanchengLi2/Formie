import { createAdminClient } from "../_shared/auth.ts";
import { createAppleClientSecret, revokeAppleRefreshToken } from "../_shared/apple-client.ts";
import { attemptExternalDeletion, type ExternalDeletionRequest } from "../_shared/external-deletion.ts";
import { executeProviderDeletion } from "../_shared/provider-deletion.ts";
import { decryptSecretEnvelope, secretEnvelopeKeyFromBase64Url } from "../_shared/secret-envelope.ts";
import { createGeminiFilesClient } from "../_shared/gemini-files.ts";
import { deleteRevenueCatCustomer } from "../_shared/revenuecat.ts";
import { secureBrowserRequest, withCors } from "../_shared/cors.ts";
import { deleteAccountHandler } from "./handler.ts";
import { listUserObjectPaths, removeUserObjects } from "./storage.ts";

function required(name: string): string { const value = Deno.env.get(name)?.trim() ?? ""; if (!value) throw new Error(`${name}_MISSING`); return value; }

Deno.serve(async (request) => {
  const security = await secureBrowserRequest(request, { methods: ["DELETE", "POST"], authentication: "user", maxBodyBytes: 4_096 });
  if (security) return security;

  const admin = createAdminClient();
  const envelopeKey = secretEnvelopeKeyFromBase64Url(required("APPLE_TOKEN_ENCRYPTION_KEY"));
  const gemini = createGeminiFilesClient({ apiKey: required("GEMINI_API_KEY") });
  const response = await deleteAccountHandler(request, {
    authenticate: async (incoming) => {
      const token = incoming.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data.user) throw new Error("UNAUTHORIZED");
      return { userId: data.user.id, appleLinked: Boolean(data.user.identities?.some((identity) => identity.provider === "apple")) };
    },
    loadExternalResources: async (userId, appleLinked) => {
      const [{ data: authorization, error: authorizationError }, { data: sessions, error: sessionsError }] = await Promise.all([
        admin.from("apple_authorizations").select("encrypted_refresh_token").eq("user_id", userId).is("revoked_at", null).maybeSingle(),
        admin.from("analysis_sessions").select("gemini_file_name").eq("user_id", userId).not("gemini_file_name", "is", null),
      ]);
      if (authorizationError) throw authorizationError;
      if (sessionsError) throw sessionsError;
      return { appleLinked, encryptedAppleRefreshToken: authorization?.encrypted_refresh_token ?? null, geminiFileNames: [...new Set((sessions ?? []).map((session) => session.gemini_file_name).filter((name): name is string => typeof name === "string" && name.length > 0))], revenueCatCustomerId: userId };
    },
    cleanupExternal: async (userId, resources) => {
      const requests: ExternalDeletionRequest[] = [];
      if (resources.encryptedAppleRefreshToken) requests.push({ provider: "apple", operation: "revoke_authorization", payload: { refreshToken: await decryptSecretEnvelope(resources.encryptedAppleRefreshToken, envelopeKey) } });
      for (const fileName of resources.geminiFileNames) requests.push({ provider: "gemini", operation: "delete_file", payload: { fileName } });
      requests.push({ provider: "revenuecat", operation: "delete_customer", payload: { customerId: resources.revenueCatCustomerId } });
      let queued = false;
      for (const externalRequest of requests) {
        const result = await attemptExternalDeletion(externalRequest, {
          encryptionKey: envelopeKey,
          execute: (current) => executeProviderDeletion(current, {
            revokeApple: async (refreshToken) => revokeAppleRefreshToken({ refreshToken, clientId: required("APPLE_CLIENT_ID"), clientSecret: await createAppleClientSecret({ teamId: required("APPLE_TEAM_ID"), keyId: required("APPLE_KEY_ID"), clientId: required("APPLE_CLIENT_ID"), privateKeyPem: required("APPLE_PRIVATE_KEY").replace(/\\n/g, "\n") }) }),
            deleteGeminiFile: (fileName) => gemini.deleteFile(fileName),
            deleteRevenueCatCustomer: (customerId) => deleteRevenueCatCustomer(customerId),
          }),
          enqueue: async (job) => { const { error } = await admin.from("external_deletion_jobs").upsert({ user_id: userId, provider: job.provider, operation: job.operation, encrypted_payload: job.encryptedPayload, fingerprint: job.fingerprint, status: "pending", next_retry_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "provider,operation,fingerprint" }); if (error) throw error; },
        });
        if (result === "queued") queued = true;
      }
      return queued ? "queued" : "complete";
    },
    listUserFiles: (bucket, userId) => listUserObjectPaths(
      bucket,
      userId,
      async (selectedBucket, prefix, offset, limit) => {
        const { data, error } = await admin.storage.from(selectedBucket).list(prefix, {
          limit,
          offset,
          sortBy: { column: "name", order: "asc" },
        });
        if (error) throw error;
        return (data ?? []).map((entry) => ({
          name: entry.name,
          id: entry.id ?? null,
          metadata: entry.metadata ?? null,
        }));
      },
    ),
    removeFiles: (bucket, userId, paths) => removeUserObjects(
      bucket,
      userId,
      paths,
      async (selectedBucket, batch) => {
        const { error } = await admin.storage.from(selectedBucket).remove(batch);
        if (error) throw error;
      },
    ),
    deleteAnalytics: async (userId) => {
      const { error } = await admin.from("product_analytics_events").delete().eq("user_id", userId);
      if (error) throw error;
    },
    deleteAuthUser: async (userId) => {
      const { error } = await admin.auth.admin.deleteUser(userId, false);
      if (error) throw error;
    },
  });

  return withCors(request, response);
});
