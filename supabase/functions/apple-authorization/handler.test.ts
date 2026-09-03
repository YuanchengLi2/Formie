import { appleAuthorizationHandler, type AppleAuthorizationDependencies } from "./handler";

function request(method: "GET" | "POST", body?: unknown) {
  return new Request("https://example.test/apple-authorization", {
    method,
    headers: { Authorization: "Bearer user-token", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function dependencies(overrides: Partial<AppleAuthorizationDependencies> = {}): AppleAuthorizationDependencies {
  return {
    authenticate: async () => ({ userId: "user-1", appleSubject: "apple-subject" }),
    hasStoredAuthorization: async () => false,
    exchangeAuthorizationCode: async () => ({ refreshToken: "refresh-token", subject: "apple-subject" }),
    openAuthorizationReceipt: async () => ({ refreshToken: "receipt-refresh-token", subject: "apple-subject" }),
    encryptRefreshToken: async () => "encrypted-refresh-token",
    storeAuthorization: async () => undefined,
    ...overrides,
  };
}

describe("apple authorization handler", () => {
  it("reports whether a linked Apple identity is ready for revocation", async () => {
    const response = await appleAuthorizationHandler(request("GET"), dependencies({ hasStoredAuthorization: async () => true }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ providerLinked: true, revocationReady: true });
  });

  it("exchanges and stores only an encrypted refresh token for the authenticated Apple subject", async () => {
    const storeAuthorization = jest.fn().mockResolvedValue(undefined);
    const response = await appleAuthorizationHandler(request("POST", { authorizationCode: "authorization-code" }), dependencies({ storeAuthorization }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ stored: true });
    expect(storeAuthorization).toHaveBeenCalledWith({
      userId: "user-1",
      appleSubject: "apple-subject",
      encryptedRefreshToken: "encrypted-refresh-token",
    });
  });

  it("does not exchange a code for an account without a linked Apple identity", async () => {
    const exchangeAuthorizationCode = jest.fn();
    const response = await appleAuthorizationHandler(request("POST", { authorizationCode: "authorization-code" }), dependencies({
      authenticate: async () => ({ userId: "user-1", appleSubject: null }),
      exchangeAuthorizationCode,
    }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "APPLE_IDENTITY_REQUIRED" });
    expect(exchangeAuthorizationCode).not.toHaveBeenCalled();
  });

  it("stores a refresh token carried by a valid short-lived receipt after Supabase links the Apple identity", async () => {
    const exchangeAuthorizationCode = jest.fn();
    const openAuthorizationReceipt = jest.fn().mockResolvedValue({ refreshToken: "receipt-refresh-token", subject: "apple-subject" });
    const encryptRefreshToken = jest.fn().mockResolvedValue("encrypted-refresh-token");
    const storeAuthorization = jest.fn().mockResolvedValue(undefined);

    const response = await appleAuthorizationHandler(
      request("POST", { authorizationReceipt: "opaque-receipt" }),
      dependencies({ exchangeAuthorizationCode, openAuthorizationReceipt, encryptRefreshToken, storeAuthorization }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ stored: true });
    expect(exchangeAuthorizationCode).not.toHaveBeenCalled();
    expect(openAuthorizationReceipt).toHaveBeenCalledWith("opaque-receipt");
    expect(encryptRefreshToken).toHaveBeenCalledWith("receipt-refresh-token");
  });

  it("rejects a receipt issued for a different Apple subject", async () => {
    const storeAuthorization = jest.fn();
    const response = await appleAuthorizationHandler(
      request("POST", { authorizationReceipt: "opaque-receipt" }),
      dependencies({
        openAuthorizationReceipt: jest.fn().mockResolvedValue({ refreshToken: "refresh-token", subject: "different-subject" }),
        storeAuthorization,
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "APPLE_SUBJECT_MISMATCH" });
    expect(storeAuthorization).not.toHaveBeenCalled();
  });

  it.each([{}, { authorizationCode: "" }, { authorizationCode: "code", extra: true }])("rejects malformed code bodies", async (body) => {
    const exchangeAuthorizationCode = jest.fn();
    const response = await appleAuthorizationHandler(request("POST", body), dependencies({ exchangeAuthorizationCode }));
    expect(response.status).toBe(400);
    expect(exchangeAuthorizationCode).not.toHaveBeenCalled();
  });

  it("reports Apple token exchange failure separately and stores nothing", async () => {
    const encryptRefreshToken = jest.fn();
    const storeAuthorization = jest.fn();
    const response = await appleAuthorizationHandler(request("POST", { authorizationCode: "authorization-code" }), dependencies({
      exchangeAuthorizationCode: jest.fn().mockRejectedValue(new Error("APPLE_TOKEN_EXCHANGE_FAILED")),
      encryptRefreshToken,
      storeAuthorization,
    }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ code: "APPLE_TOKEN_EXCHANGE_FAILED" });
    expect(encryptRefreshToken).not.toHaveBeenCalled();
    expect(storeAuthorization).not.toHaveBeenCalled();
  });

  it("reports encrypted token custody failure after a successful exchange", async () => {
    const response = await appleAuthorizationHandler(request("POST", { authorizationCode: "authorization-code" }), dependencies({
      encryptRefreshToken: jest.fn().mockRejectedValue(new Error("encryption unavailable")),
    }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ code: "APPLE_AUTHORIZATION_STORAGE_FAILED" });
  });
});
