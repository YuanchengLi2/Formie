import { verifyAppleServerEvent } from "./apple-events";

const encoder = new TextEncoder();
const base64Url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");
const segment = (value: unknown) => base64Url(encoder.encode(JSON.stringify(value)));

async function signedEvent(overrides: Record<string, unknown> = {}) {
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicJwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
  const header = segment({ alg: "ES256", kid: "apple-key" });
  const payload = segment({
    iss: "https://appleid.apple.com",
    aud: "app.form.coach",
    iat: 1788264000,
    exp: 1788267600,
    events: { type: "consent-revoked", sub: "apple-subject" },
    ...overrides,
  });
  const signature = new Uint8Array(await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keys.privateKey,
    encoder.encode(`${header}.${payload}`),
  ));
  return {
    signedPayload: `${header}.${payload}.${base64Url(signature)}`,
    fetcher: jest.fn(async () => Response.json({ keys: [{ ...publicJwk, kid: "apple-key" }] })) as typeof fetch,
  };
}

describe("Apple server event verification", () => {
  const now = new Date("2026-09-01T12:30:00.000Z");

  it("verifies Apple's ES256 signature and required lifecycle claims", async () => {
    const event = await signedEvent();
    await expect(verifyAppleServerEvent(event.signedPayload, {
      clientId: "app.form.coach",
      fetcher: event.fetcher,
      now,
    })).resolves.toEqual({ eventType: "consent-revoked", subject: "apple-subject" });
    expect(event.fetcher).toHaveBeenCalledWith("https://appleid.apple.com/auth/keys");
  });

  it("rejects a payload signed for another client", async () => {
    const event = await signedEvent({ aud: "other.client" });
    await expect(verifyAppleServerEvent(event.signedPayload, {
      clientId: "app.form.coach",
      fetcher: event.fetcher,
      now,
    })).rejects.toThrow("APPLE_EVENT_CLAIMS_INVALID");
  });

  it("rejects expired and tampered signed payloads", async () => {
    const expired = await signedEvent({ exp: 1788263999 });
    await expect(verifyAppleServerEvent(expired.signedPayload, {
      clientId: "app.form.coach",
      fetcher: expired.fetcher,
      now,
    })).rejects.toThrow("APPLE_EVENT_CLAIMS_INVALID");

    const valid = await signedEvent();
    const [header, payload, signature] = valid.signedPayload.split(".");
    const tamperedPayload = segment({ iss: "https://appleid.apple.com", aud: "app.form.coach", iat: 1788264000, exp: 1788267600, events: { type: "account-delete", sub: "attacker" } });
    await expect(verifyAppleServerEvent(`${header}.${tamperedPayload}.${signature}`, {
      clientId: "app.form.coach",
      fetcher: valid.fetcher,
      now,
    })).rejects.toThrow("APPLE_EVENT_SIGNATURE_INVALID");
    expect(payload).not.toBe(tamperedPayload);
  });
});
