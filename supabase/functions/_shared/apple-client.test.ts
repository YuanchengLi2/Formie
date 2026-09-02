import { createAppleClientSecret, exchangeAppleAuthorizationCode, revokeAppleRefreshToken } from "./apple-client";

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(Buffer.from(normalized, "base64"));
}

async function testSigningKey() {
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", keys.privateKey));
  const body = Buffer.from(pkcs8).toString("base64").match(/.{1,64}/g)?.join("\n") ?? "";
  return { privateKeyPem: `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`, publicKey: keys.publicKey };
}

describe("Apple OAuth client", () => {
  it("creates a signed ES256 client secret with bounded Apple claims", async () => {
    const signing = await testSigningKey();
    const now = new Date("2026-09-01T12:00:00.000Z");
    const jwt = await createAppleClientSecret({
      teamId: "TEAM123",
      keyId: "KEY123",
      clientId: "app.form.coach",
      privateKeyPem: signing.privateKeyPem,
      now,
    });
    const [header, payload, signature] = jwt.split(".");

    expect(JSON.parse(Buffer.from(base64UrlToBytes(header)).toString("utf8"))).toEqual({ alg: "ES256", kid: "KEY123", typ: "JWT" });
    expect(JSON.parse(Buffer.from(base64UrlToBytes(payload)).toString("utf8"))).toEqual({
      iss: "TEAM123",
      iat: 1788264000,
      exp: 1803816000,
      aud: "https://appleid.apple.com",
      sub: "app.form.coach",
    });
    await expect(crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      signing.publicKey,
      base64UrlToBytes(signature),
      new TextEncoder().encode(`${header}.${payload}`),
    )).resolves.toBe(true);
  });

  it("exchanges an authorization code and verifies the returned Apple subject", async () => {
    const idToken = `x.${Buffer.from(JSON.stringify({ sub: "apple-subject" })).toString("base64url")}.x`;
    const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify({ refresh_token: "refresh-token", id_token: idToken }), { status: 200 }));

    await expect(exchangeAppleAuthorizationCode({
      authorizationCode: "authorization-code",
      expectedSubject: "apple-subject",
      clientId: "app.form.coach",
      clientSecret: "client-secret",
      fetcher,
    })).resolves.toEqual({ refreshToken: "refresh-token", subject: "apple-subject" });
    expect(fetcher).toHaveBeenCalledWith("https://appleid.apple.com/auth/token", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("grant_type=authorization_code"),
    }));
  });

  it("rejects a code whose Apple subject does not match the signed-in identity", async () => {
    const idToken = `x.${Buffer.from(JSON.stringify({ sub: "other-subject" })).toString("base64url")}.x`;
    const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify({ refresh_token: "refresh-token", id_token: idToken }), { status: 200 }));

    await expect(exchangeAppleAuthorizationCode({ authorizationCode: "code", expectedSubject: "apple-subject", clientId: "client", clientSecret: "secret", fetcher })).rejects.toThrow("APPLE_SUBJECT_MISMATCH");
  });

  it("revokes refresh tokens without placing them in the URL", async () => {
    const fetcher = jest.fn().mockResolvedValue(new Response(null, { status: 200 }));

    await revokeAppleRefreshToken({ refreshToken: "refresh-token", clientId: "app.form.coach", clientSecret: "client-secret", fetcher });

    expect(fetcher).toHaveBeenCalledWith("https://appleid.apple.com/auth/revoke", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("token=refresh-token"),
    }));
    expect(fetcher.mock.calls[0][0]).not.toContain("refresh-token");
  });

  it("treats an already-invalid refresh token as idempotently revoked", async () => {
    const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify({ error: "invalid_token" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    }));

    await expect(revokeAppleRefreshToken({
      refreshToken: "already-invalid",
      clientId: "app.form.coach",
      clientSecret: "client-secret",
      fetcher,
    })).resolves.toBeUndefined();
  });

  it("preserves the HTTP status for actionable revocation failures", async () => {
    const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify({ error: "invalid_client" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    }));

    await expect(revokeAppleRefreshToken({
      refreshToken: "refresh-token",
      clientId: "app.form.coach",
      clientSecret: "bad-client-secret",
      fetcher,
    })).rejects.toMatchObject({ message: "APPLE_TOKEN_REVOCATION_FAILED", httpStatus: 400 });
  });
});
