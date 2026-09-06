import { createAppleAuthorizationReceipt } from "../_shared/apple-authorization-receipt.ts";
import { createAppleClientSecret, exchangeAppleAuthorizationCode } from "../_shared/apple-client.ts";
import { secureBrowserRequest, withCors } from "../_shared/cors.ts";
import { secretEnvelopeKeyFromBase64Url } from "../_shared/secret-envelope.ts";
import { appleTokenExchangeHandler } from "./handler.ts";

function requiredSecret(name: string): string {
  const value = Deno.env.get(name)?.trim() ?? "";
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

Deno.serve(async (request) => {
  const security = await secureBrowserRequest(request, { methods: ["POST"], authentication: "service", maxBodyBytes: 4_096 });
  if (security) return security;
  const clientId = requiredSecret("APPLE_CLIENT_ID");
  const encryptionKey = secretEnvelopeKeyFromBase64Url(requiredSecret("APPLE_TOKEN_ENCRYPTION_KEY"));
  const response = await appleTokenExchangeHandler(request, {
    exchangeAuthorizationCode: async (authorizationCode, nonce) => {
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
        return await exchangeAppleAuthorizationCode({ authorizationCode, expectedNonce: nonce, clientId, clientSecret });
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
    createAuthorizationReceipt: (input) => createAppleAuthorizationReceipt(input, encryptionKey),
  });
  return withCors(request, response);
});
