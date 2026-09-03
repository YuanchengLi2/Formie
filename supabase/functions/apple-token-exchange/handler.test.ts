import { appleTokenExchangeHandler, type AppleTokenExchangeDependencies } from "./handler";

function request(body: unknown) {
  return new Request("https://example.test/apple-token-exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function dependencies(overrides: Partial<AppleTokenExchangeDependencies> = {}): AppleTokenExchangeDependencies {
  return {
    exchangeAuthorizationCode: async () => ({
      refreshToken: "refresh-token",
      identityToken: "identity-token",
      subject: "apple-subject",
    }),
    createAuthorizationReceipt: async () => "authorization-receipt",
    ...overrides,
  };
}

describe("Apple pre-authentication token exchange", () => {
  it("exchanges a one-time code against the request nonce and returns an opaque custody receipt", async () => {
    const exchangeAuthorizationCode = jest.fn().mockResolvedValue({
      refreshToken: "refresh-token",
      identityToken: "identity-token",
      subject: "apple-subject",
    });
    const createAuthorizationReceipt = jest.fn().mockResolvedValue("authorization-receipt");

    const response = await appleTokenExchangeHandler(request({
      authorizationCode: "authorization-code",
      nonce: "a".repeat(64),
    }), dependencies({ exchangeAuthorizationCode, createAuthorizationReceipt }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ identityToken: "identity-token", authorizationReceipt: "authorization-receipt" });
    expect(exchangeAuthorizationCode).toHaveBeenCalledWith("authorization-code", "a".repeat(64));
    expect(createAuthorizationReceipt).toHaveBeenCalledWith({ refreshToken: "refresh-token", subject: "apple-subject" });
  });

  it.each([
    {},
    { authorizationCode: "", nonce: "a".repeat(64) },
    { authorizationCode: "code", nonce: "short" },
    { authorizationCode: "code", nonce: "a".repeat(64), extra: true },
  ])("rejects malformed exchange requests", async (body) => {
    const exchangeAuthorizationCode = jest.fn();
    const response = await appleTokenExchangeHandler(request(body), dependencies({ exchangeAuthorizationCode }));

    expect(response.status).toBe(400);
    expect(exchangeAuthorizationCode).not.toHaveBeenCalled();
  });

  it("does not expose Apple exchange details on failure", async () => {
    const response = await appleTokenExchangeHandler(request({
      authorizationCode: "authorization-code",
      nonce: "a".repeat(64),
    }), dependencies({ exchangeAuthorizationCode: jest.fn().mockRejectedValue(new Error("invalid_grant secret details")) }));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ code: "APPLE_TOKEN_EXCHANGE_FAILED" });
  });
});
