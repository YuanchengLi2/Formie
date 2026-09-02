type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
}
function jsonSegment(value: string): Record<string, unknown> { return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as Record<string, unknown>; }

export type AppleServerEvent = { eventType: string; subject: string };

export async function verifyAppleServerEvent(signedPayload: string, { clientId, fetcher = fetch, now = new Date() }: { clientId: string; fetcher?: Fetcher; now?: Date }): Promise<AppleServerEvent> {
  const [encodedHeader, encodedPayload, encodedSignature, extra] = signedPayload.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature || extra) throw new Error("APPLE_EVENT_INVALID");
  const header = jsonSegment(encodedHeader);
  if (header.alg !== "ES256" || typeof header.kid !== "string") throw new Error("APPLE_EVENT_ALGORITHM_INVALID");
  const keysResponse = await fetcher("https://appleid.apple.com/auth/keys");
  if (!keysResponse.ok) throw new Error("APPLE_KEYS_UNAVAILABLE");
  const keysPayload = await keysResponse.json() as { keys?: JsonWebKey[] };
  const jwk = keysPayload.keys?.find((key) => key.kid === header.kid && key.kty === "EC" && key.crv === "P-256");
  if (!jwk) throw new Error("APPLE_EVENT_KEY_NOT_FOUND");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const verified = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, decodeBase64Url(encodedSignature), new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`));
  if (!verified) throw new Error("APPLE_EVENT_SIGNATURE_INVALID");
  const payload = jsonSegment(encodedPayload);
  const audience = payload.aud;
  const audienceMatches = audience === clientId || Array.isArray(audience) && audience.includes(clientId);
  const expiresAt = typeof payload.exp === "number" ? payload.exp * 1_000 : NaN;
  const issuedAt = typeof payload.iat === "number" ? payload.iat * 1_000 : NaN;
  if (payload.iss !== "https://appleid.apple.com" || !audienceMatches || !Number.isFinite(expiresAt) || expiresAt <= now.getTime() || !Number.isFinite(issuedAt) || issuedAt > now.getTime() + 5 * 60_000) throw new Error("APPLE_EVENT_CLAIMS_INVALID");
  const events = payload.events && typeof payload.events === "object" ? payload.events as Record<string, unknown> : {};
  const eventType = typeof events.type === "string" ? events.type : "";
  const subject = typeof events.sub === "string" ? events.sub : "";
  if (!eventType || !subject) throw new Error("APPLE_EVENT_PAYLOAD_INVALID");
  return { eventType, subject };
}
