export type AppleTokenExchangeDependencies = {
  exchangeAuthorizationCode(authorizationCode: string, nonce: string): Promise<{
    refreshToken: string;
    identityToken: string;
    subject: string;
  }>;
  createAuthorizationReceipt(input: { refreshToken: string; subject: string }): Promise<string>;
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

function exchangeInput(body: unknown): { authorizationCode: string; nonce: string } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  if (Object.keys(record).length !== 2 || typeof record.authorizationCode !== "string" || typeof record.nonce !== "string") return null;
  const authorizationCode = record.authorizationCode.trim();
  const nonce = record.nonce.trim();
  if (!authorizationCode || authorizationCode.length > 2_048 || !/^[a-f0-9]{64}$/i.test(nonce)) return null;
  return { authorizationCode, nonce };
}

export async function appleTokenExchangeHandler(request: Request, dependencies: AppleTokenExchangeDependencies): Promise<Response> {
  if (request.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED" }, 405);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const input = exchangeInput(body);
  if (!input) return json({ code: "INVALID_BODY" }, 400);

  try {
    const exchanged = await dependencies.exchangeAuthorizationCode(input.authorizationCode, input.nonce);
    const authorizationReceipt = await dependencies.createAuthorizationReceipt({
      refreshToken: exchanged.refreshToken,
      subject: exchanged.subject,
    });
    return json({ identityToken: exchanged.identityToken, authorizationReceipt }, 200);
  } catch {
    return json({ code: "APPLE_TOKEN_EXCHANGE_FAILED" }, 502);
  }
}
