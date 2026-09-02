import { verifyAppleServerEvent } from "../_shared/apple-events.ts";
import { createAdminClient } from "../_shared/auth.ts";
import { validateRequestSecurity } from "../_shared/request-security.ts";
import { prepareExternalDeletionJob, type ExternalDeletionRequest } from "../_shared/external-deletion.ts";
import { secretEnvelopeKeyFromBase64Url } from "../_shared/secret-envelope.ts";
import { accountStorageBuckets, listUserObjectPaths, removeUserObjects } from "../delete-account/storage.ts";
import { appleAuthEventsHandler } from "./handler.ts";

Deno.serve(async (request) => {
  const security = await validateRequestSecurity(request, { methods: ["POST"], authentication: "webhook", maxBodyBytes: 16_384, allowBrowserOrigin: false });
  if (security) return security;
  const admin = createAdminClient();
  return appleAuthEventsHandler(request, {
    verify: (signedPayload) => verifyAppleServerEvent(signedPayload, { clientId: Deno.env.get("APPLE_CLIENT_ID") ?? "" }),
    markRevoked: async (appleSubject, eventType) => {
      const { data, error } = await admin.from("apple_authorizations").update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("apple_subject", appleSubject).select("user_id").maybeSingle();
      if (error) throw error;
      let resolvedUserId: string | null = null;
      if (eventType === "account-delete" && !data?.user_id) {
        const { data: legacyUserId, error: identityError } = await admin.rpc("resolve_apple_identity_user_id", { p_subject: appleSubject });
        if (identityError) throw identityError;
        resolvedUserId = typeof legacyUserId === "string" && legacyUserId.length > 0 ? legacyUserId : null;
      }
      const userId = data?.user_id ?? resolvedUserId;
      if (eventType === "account-delete" && userId) {
        const key = secretEnvelopeKeyFromBase64Url(Deno.env.get("APPLE_TOKEN_ENCRYPTION_KEY") ?? "");
        const { data: sessions, error: sessionsError } = await admin.from("analysis_sessions").select("gemini_file_name").eq("user_id", userId).not("gemini_file_name", "is", null);
        if (sessionsError) throw sessionsError;
        const requests: ExternalDeletionRequest[] = [...new Set((sessions ?? []).map((session) => session.gemini_file_name).filter((name): name is string => typeof name === "string"))].map((fileName) => ({ provider: "gemini", operation: "delete_file", payload: { fileName } }));
        requests.push({ provider: "revenuecat", operation: "delete_customer", payload: { customerId: userId } });
        for (const externalRequest of requests) {
          const job = await prepareExternalDeletionJob(externalRequest, key);
          const { error: queueError } = await admin.from("external_deletion_jobs").upsert({ user_id: userId, provider: job.provider, operation: job.operation, encrypted_payload: job.encryptedPayload, fingerprint: job.fingerprint, status: "pending", next_retry_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "provider,operation,fingerprint" });
          if (queueError) throw queueError;
        }
        for (const bucket of accountStorageBuckets) {
          const paths = await listUserObjectPaths(bucket, userId, async (selectedBucket, prefix, offset, limit) => {
            const { data: entries, error: listError } = await admin.storage.from(selectedBucket).list(prefix, { limit, offset, sortBy: { column: "name", order: "asc" } });
            if (listError) throw listError;
            return (entries ?? []).map((entry) => ({ name: entry.name, id: entry.id ?? null, metadata: entry.metadata ?? null }));
          });
          if (paths.length) await removeUserObjects(bucket, userId, paths, async (selectedBucket, batch) => { const { error: removeError } = await admin.storage.from(selectedBucket).remove(batch); if (removeError) throw removeError; });
        }
        const { error: analyticsError } = await admin.from("product_analytics_events").delete().eq("user_id", userId);
        if (analyticsError) throw analyticsError;
        const { error: authError } = await admin.auth.admin.deleteUser(userId, false);
        if (authError) throw authError;
      }
    },
  });
});
