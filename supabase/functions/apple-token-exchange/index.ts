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
      const clientSecret = await createAppleClientSecret({
        teamId: requiredSecret("APPLE_TEAM_ID"),
        keyId: requiredSecret("APPLE_KEY_ID"),
        clientId,
        privateKeyPem: requiredSecret("APPLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
      });
      return exchangeAppleAuthorizationCode({ authorizationCode, expectedNonce: nonce, clientId, clientSecret });
    },
    createAuthorizationReceipt: (input) => createAppleAuthorizationReceipt(input, encryptionKey),
  });
  return withCors(request, response);
});
