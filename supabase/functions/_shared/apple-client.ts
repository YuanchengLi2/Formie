const encoder = new TextEncoder();

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function encodeJson(value: unknown): string {
  return encodeBase64Url(encoder.encode(JSON.stringify(value)));
}

function decodeJsonSegment(segment: string): Record<string, unknown> {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(segment.length / 4) * 4, "=");
  return JSON.parse(atob(normalized)) as Record<string, unknown>;
}

function privateKeyBytes(privateKeyPem: string): Uint8Array {
  const body = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  if (!body) throw new Error("APPLE_PRIVATE_KEY_INVALID");
  return Uint8Array.from(atob(body), (character) => character.charCodeAt(0));
}

export async function createAppleClientSecret({
  teamId,
  keyId,
  clientId,
  privateKeyPem,
  now = new Date(),
}: {
  teamId: string;
  keyId: string;
  clientId: string;
  privateKeyPem: string;
  now?: Date;
}): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const header = encodeJson({ alg: "ES256", kid: keyId, typ: "JWT" });
  const payload = encodeJson({
    iss: teamId,
    iat: issuedAt,
    exp: issuedAt + 180 * 24 * 60 * 60,
    aud: "https://appleid.apple.com",
    sub: clientId,
  });
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes(privateKeyPem),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, encoder.encode(signingInput)));
  return `${signingInput}.${encodeBase64Url(signature)}`;
}

function formBody(values: Record<string, string>): string {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) body.set(key, value);
  return body.toString();
}

export async function exchangeAppleAuthorizationCode({
  authorizationCode,
  expectedSubject,
  clientId,
  clientSecret,
  fetcher = fetch,
}: {
  authorizationCode: string;
  expectedSubject: string;
  clientId: string;
  clientSecret: string;
  fetcher?: typeof fetch;
}): Promise<{ refreshToken: string; subject: string }> {
  const response = await fetcher("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody({
      grant_type: "authorization_code",
      code: authorizationCode,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error("APPLE_TOKEN_EXCHANGE_FAILED");
  const refreshToken = typeof payload.refresh_token === "string" ? payload.refresh_token : "";
  const idToken = typeof payload.id_token === "string" ? payload.id_token : "";
  const subject = idToken.split(".")[1] ? String(decodeJsonSegment(idToken.split(".")[1]!).sub ?? "") : "";
  if (!refreshToken || !subject) throw new Error("APPLE_TOKEN_RESPONSE_INVALID");
  if (subject !== expectedSubject) throw new Error("APPLE_SUBJECT_MISMATCH");
  return { refreshToken, subject };
}

export async function revokeAppleRefreshToken({
  refreshToken,
  clientId,
  clientSecret,
  fetcher = fetch,
}: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  fetcher?: typeof fetch;
}): Promise<void> {
  const response = await fetcher("https://appleid.apple.com/auth/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody({ token: refreshToken, token_type_hint: "refresh_token", client_id: clientId, client_secret: clientSecret }),
  });
  if (response.ok) return;
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (response.status === 400 && payload.error === "invalid_token") return;
  throw Object.assign(new Error("APPLE_TOKEN_REVOCATION_FAILED"), { httpStatus: response.status });
}
