import { createAdminClient } from "../_shared/auth.ts";
import { openAppleAuthorizationReceipt } from "../_shared/apple-authorization-receipt.ts";
import { createAppleClientSecret, exchangeAppleAuthorizationCode } from "../_shared/apple-client.ts";
import { secureBrowserRequest, withCors } from "../_shared/cors.ts";
import { encryptSecretEnvelope, secretEnvelopeKeyFromBase64Url } from "../_shared/secret-envelope.ts";
import { appleAuthorizationHandler } from "./handler.ts";

function requiredSecret(name: string): string {
  const value = Deno.env.get(name)?.trim() ?? "";
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

Deno.serve(async (request) => {
  const security = await secureBrowserRequest(request, { methods: ["GET", "POST"], authentication: "user", maxBodyBytes: 4_096 });
  if (security) return security;
  const admin = createAdminClient();
  const clientId = requiredSecret("APPLE_CLIENT_ID");

  const response = await appleAuthorizationHandler(request, {
    authenticate: async (incoming) => {
      const token = incoming.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data.user) throw new Error("UNAUTHORIZED");
      const appleIdentity = data.user.identities?.find((identity) => identity.provider === "apple") ?? null;
      const subject = appleIdentity
        ? String(appleIdentity.identity_data?.sub ?? appleIdentity.id ?? "").trim() || null
        : null;
      return { userId: data.user.id, appleSubject: subject };
    },
    hasStoredAuthorization: async (userId) => {
      const { data, error } = await admin.from("apple_authorizations").select("user_id").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    exchangeAuthorizationCode: async (code, expectedSubject) => {
      let stage = "read_team_id";
      try {
        const teamId = requiredSecret("APPLE_TEAM_ID");
        stage = "read_key_id";
        const keyId = requiredSecret("APPLE_KEY_ID");
        stage = "read_private_key";
        const privateKeyPem = requiredSecret("APPLE_PRIVATE_KEY").replace(/\\n/g, "\n");
        stage = "client_secret_signing";
        const clientSecret = await createAppleClientSecret({
          teamId,
          keyId,
          clientId,
          privateKeyPem,
        });
        stage = "provider_exchange";
        return await exchangeAppleAuthorizationCode({ authorizationCode: code, expectedSubject, clientId, clientSecret });
      } catch (error) {
        const diagnostic = error && typeof error === "object" ? error as Record<string, unknown> : {};
        const localCode = error instanceof Error && /^APPLE_[A-Z0-9_]+$/.test(error.message) ? error.message : null;
        console.error(JSON.stringify({
          event: "apple_token_exchange_failed",
          stage,
          localCode,
          providerCode: typeof diagnostic.providerCode === "string" ? diagnostic.providerCode : "local_validation",
          httpStatus: typeof diagnostic.httpStatus === "number" ? diagnostic.httpStatus : null,
        }));
        throw error;
      }
    },
    openAuthorizationReceipt: (receipt) => openAppleAuthorizationReceipt(
      receipt,
      secretEnvelopeKeyFromBase64Url(requiredSecret("APPLE_TOKEN_ENCRYPTION_KEY")),
    ),
    encryptRefreshToken: (refreshToken) => encryptSecretEnvelope(
      refreshToken,
      secretEnvelopeKeyFromBase64Url(requiredSecret("APPLE_TOKEN_ENCRYPTION_KEY")),
    ),
    storeAuthorization: async ({ userId, appleSubject, encryptedRefreshToken }) => {
      const { error } = await admin.from("apple_authorizations").upsert({
        user_id: userId,
        apple_subject: appleSubject,
        encrypted_refresh_token: encryptedRefreshToken,
        revoked_at: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) throw error;
    },
  });
  return withCors(request, response);
});
