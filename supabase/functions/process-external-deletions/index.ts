import { createAppleClientSecret, revokeAppleRefreshToken } from "../_shared/apple-client.ts";
import { createAdminClient } from "../_shared/auth.ts";
import { decryptSecretEnvelope, secretEnvelopeKeyFromBase64Url } from "../_shared/secret-envelope.ts";
import { createGeminiFilesClient } from "../_shared/gemini-files.ts";
import { deleteRevenueCatCustomer } from "../_shared/revenuecat.ts";
import { executeProviderDeletion } from "../_shared/provider-deletion.ts";
import { sendExternalDeletionTerminalAlert } from "../_shared/operational-alert.ts";
import { constantTimeEqual, validateRequestSecurity } from "../_shared/request-security.ts";
import { processExternalDeletionsHandler } from "./handler.ts";

function required(name: string): string { const value = Deno.env.get(name)?.trim() ?? ""; if (!value) throw new Error(`${name}_MISSING`); return value; }
function authenticate(request: Request): Promise<void> { const supplied = request.headers.get("x-cron-secret") ?? ""; const configured = Deno.env.get("EXTERNAL_DELETION_WORKER_SECRET") ?? ""; return supplied && configured && constantTimeEqual(supplied, configured) ? Promise.resolve() : Promise.reject(new Error("UNAUTHORIZED")); }

Deno.serve(async (request) => {
  const security = await validateRequestSecurity(request, { methods: ["POST"], authentication: "webhook", maxBodyBytes: 1_024, allowBrowserOrigin: false });
  if (security) return security;
  const admin = createAdminClient();
  const envelopeKey = secretEnvelopeKeyFromBase64Url(required("APPLE_TOKEN_ENCRYPTION_KEY"));
  const gemini = createGeminiFilesClient({ apiKey: required("GEMINI_API_KEY") });
  const response = await processExternalDeletionsHandler(request, {
    authenticate,
    claimDue: async (limit) => {
      const { data, error } = await admin.rpc("claim_external_deletion_jobs", { p_limit: limit });
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({ id: String(row.id), provider: row.provider as "apple" | "gemini" | "revenuecat", operation: row.operation as "revoke_authorization" | "delete_file" | "delete_customer", encryptedPayload: String(row.encrypted_payload), attempts: Number(row.attempts), expiresAt: String(row.expires_at) }));
    },
    execute: async (job) => {
      const payload = JSON.parse(await decryptSecretEnvelope(job.encryptedPayload, envelopeKey)) as Record<string, string>;
      await executeProviderDeletion({ provider: job.provider, operation: job.operation, payload }, {
        revokeApple: async (refreshToken) => revokeAppleRefreshToken({ refreshToken, clientId: required("APPLE_CLIENT_ID"), clientSecret: await createAppleClientSecret({ teamId: required("APPLE_TEAM_ID"), keyId: required("APPLE_KEY_ID"), clientId: required("APPLE_CLIENT_ID"), privateKeyPem: required("APPLE_PRIVATE_KEY").replace(/\\n/g, "\n") }) }),
        deleteGeminiFile: (fileName) => gemini.deleteFile(fileName),
        deleteRevenueCatCustomer: (customerId) => deleteRevenueCatCustomer(customerId),
      });
    },
    complete: async (id) => { const { error } = await admin.from("external_deletion_jobs").delete().eq("id", id); if (error) throw error; },
    retry: async (id, update) => { const { error } = await admin.from("external_deletion_jobs").update({ status: "pending", attempts: update.attempts, next_retry_at: update.nextRetryAt, last_error_code: update.errorCode, updated_at: new Date().toISOString() }).eq("id", id); if (error) throw error; },
    terminal: async (job, update) => {
      await sendExternalDeletionTerminalAlert({ jobId: job.id, provider: job.provider, operation: job.operation, attempts: update.attempts, errorCode: update.errorCode, apiKey: required("RESEND_API_KEY"), from: required("FORMIE_SUPPORT_FROM"), to: required("FORMIE_SUPPORT_TO") });
      const { error } = await admin.from("external_deletion_jobs").update({ status: "terminal_failed", attempts: update.attempts, last_error_code: update.errorCode, updated_at: new Date().toISOString() }).eq("id", job.id);
      if (error) throw error;
    },
  });
  return response;
});
