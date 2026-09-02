export type AppleAuthorizationDependencies = {
  authenticate(request: Request): Promise<{ userId: string; appleSubject: string | null }>;
  hasStoredAuthorization(userId: string): Promise<boolean>;
  exchangeAuthorizationCode(authorizationCode: string, expectedSubject: string): Promise<{ refreshToken: string; subject: string }>;
  encryptRefreshToken(refreshToken: string): Promise<string>;
  storeAuthorization(input: { userId: string; appleSubject: string; encryptedRefreshToken: string }): Promise<void>;
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

function authorizationCode(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  if (Object.keys(record).length !== 1 || typeof record.authorizationCode !== "string") return null;
  const value = record.authorizationCode.trim();
  return value.length > 0 && value.length <= 2_048 ? value : null;
}

export async function appleAuthorizationHandler(request: Request, dependencies: AppleAuthorizationDependencies): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED" }, 405);

  let identity: { userId: string; appleSubject: string | null };
  try {
    identity = await dependencies.authenticate(request);
  } catch {
    return json({ code: "UNAUTHORIZED" }, 401);
  }

  if (request.method === "GET") {
    const revocationReady = await dependencies.hasStoredAuthorization(identity.userId);
    return json({ providerLinked: Boolean(identity.appleSubject), revocationReady }, 200);
  }
  if (!identity.appleSubject) return json({ code: "APPLE_IDENTITY_REQUIRED" }, 409);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const code = authorizationCode(body);
  if (!code) return json({ code: "INVALID_BODY" }, 400);

  let exchanged: { refreshToken: string; subject: string };
  try {
    exchanged = await dependencies.exchangeAuthorizationCode(code, identity.appleSubject);
  } catch {
    return json({ code: "APPLE_TOKEN_EXCHANGE_FAILED" }, 502);
  }

  try {
    const encryptedRefreshToken = await dependencies.encryptRefreshToken(exchanged.refreshToken);
    await dependencies.storeAuthorization({
      userId: identity.userId,
      appleSubject: exchanged.subject,
      encryptedRefreshToken,
    });
    return json({ stored: true }, 200);
  } catch {
    return json({ code: "APPLE_AUTHORIZATION_STORAGE_FAILED" }, 502);
  }
}
