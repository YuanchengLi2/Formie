import { AppleSignInError, signInWithApple } from "./apple-authentication";

const mockSignInAsync = jest.fn();
const mockDigestStringAsync = jest.fn();
const mockGetRandomBytes = jest.fn();
const nativeDependencies = {
  requestCredential: mockSignInAsync,
  getRandomBytes: mockGetRandomBytes,
  digestString: mockDigestStringAsync,
};

describe("native Apple authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRandomBytes.mockReturnValue(Uint8Array.from([0, 1, 2, 253, 254, 255]));
    mockDigestStringAsync.mockResolvedValue("hashed-nonce");
  });

  it("uses a random raw nonce for Supabase and its SHA-256 digest for Apple", async () => {
    mockSignInAsync.mockResolvedValue({
      identityToken: "identity-token",
      authorizationCode: "authorization-code",
      fullName: { givenName: "Formie", familyName: "Reviewer" },
    });
    const signInWithIdToken = jest.fn().mockResolvedValue({ user: { id: "apple-user" } });
    const storeAuthorization = jest.fn().mockResolvedValue({ stored: true });
    const exchangeAuthorizationCode = jest.fn();
    const saveFullName = jest.fn().mockResolvedValue(undefined);

    await expect(signInWithApple({ signInWithIdToken, storeAuthorization, exchangeAuthorizationCode, saveFullName, ...nativeDependencies })).resolves.toEqual({ user: { id: "apple-user" } });

    expect(mockDigestStringAsync).toHaveBeenCalledWith("SHA-256", "AAEC_f7_");
    expect(mockSignInAsync).toHaveBeenCalledWith(expect.objectContaining({ nonce: "hashed-nonce" }));
    expect(signInWithIdToken).toHaveBeenCalledWith("identity-token", "AAEC_f7_");
    expect(storeAuthorization).toHaveBeenCalledWith({ authorizationCode: "authorization-code" });
    expect(exchangeAuthorizationCode).not.toHaveBeenCalled();
    expect(saveFullName).toHaveBeenCalledWith("Formie Reviewer");
  });

  it("exchanges Apple's authorization code when the native credential omits its nullable identity token", async () => {
    mockSignInAsync.mockResolvedValue({ identityToken: null, authorizationCode: "authorization-code", fullName: null });
    const signInWithIdToken = jest.fn().mockResolvedValue({ user: { id: "apple-user" } });
    const exchangeAuthorizationCode = jest.fn().mockResolvedValue({
      identityToken: "server-identity-token",
      authorizationReceipt: "authorization-receipt",
    });
    const storeAuthorization = jest.fn().mockResolvedValue({ stored: true });

    await expect(signInWithApple({
      signInWithIdToken,
      exchangeAuthorizationCode,
      storeAuthorization,
      saveFullName: jest.fn(),
      ...nativeDependencies,
    })).resolves.toEqual({ user: { id: "apple-user" } });

    expect(exchangeAuthorizationCode).toHaveBeenCalledWith("authorization-code", "hashed-nonce");
    expect(signInWithIdToken).toHaveBeenCalledWith("server-identity-token", "AAEC_f7_");
    expect(storeAuthorization).toHaveBeenCalledWith({ authorizationReceipt: "authorization-receipt" });
  });

  it("fails closed when Apple omits both usable identity-token paths", async () => {
    mockSignInAsync.mockResolvedValue({ identityToken: null, authorizationCode: null });

    await expect(signInWithApple({
      signInWithIdToken: jest.fn(),
      exchangeAuthorizationCode: jest.fn(),
      storeAuthorization: jest.fn(),
      saveFullName: jest.fn(),
      ...nativeDependencies,
    })).rejects.toMatchObject({ code: "MISSING_AUTHORIZATION_CODE" });
  });

  it("ends the local session when server-side revocation custody fails", async () => {
    mockSignInAsync.mockResolvedValue({ identityToken: "identity-token", authorizationCode: "authorization-code", fullName: null });
    const signOut = jest.fn().mockResolvedValue(undefined);

    await expect(signInWithApple({
      signInWithIdToken: jest.fn().mockResolvedValue({ user: { id: "apple-user" } }),
      exchangeAuthorizationCode: jest.fn(),
      storeAuthorization: jest.fn().mockRejectedValue(new Error("function unavailable")),
      saveFullName: jest.fn(),
      signOut,
      ...nativeDependencies,
    })).rejects.toEqual(expect.objectContaining<Partial<AppleSignInError>>({ code: "TOKEN_CUSTODY_FAILED" }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("reports a nonce mismatch before attempting token custody", async () => {
    mockSignInAsync.mockResolvedValue({ identityToken: "identity-token", authorizationCode: "authorization-code", fullName: null });
    const storeAuthorization = jest.fn();

    await expect(signInWithApple({
      signInWithIdToken: jest.fn().mockRejectedValue(new Error("Nonce mismatch")),
      exchangeAuthorizationCode: jest.fn(),
      storeAuthorization,
      saveFullName: jest.fn(),
      ...nativeDependencies,
    })).rejects.toMatchObject({ code: "NONCE_MISMATCH" });
    expect(storeAuthorization).not.toHaveBeenCalled();
  });

  it("distinguishes Apple authorization-code exchange failure from storage failure", async () => {
    mockSignInAsync.mockResolvedValue({ identityToken: "identity-token", authorizationCode: "authorization-code", fullName: null });
    const signOut = jest.fn().mockResolvedValue(undefined);
    const exchangeError = Object.assign(new Error("exchange failed"), { code: "APPLE_TOKEN_EXCHANGE_FAILED" });

    await expect(signInWithApple({
      signInWithIdToken: jest.fn().mockResolvedValue({ user: { id: "apple-user" } }),
      exchangeAuthorizationCode: jest.fn(),
      storeAuthorization: jest.fn().mockRejectedValue(exchangeError),
      saveFullName: jest.fn(),
      signOut,
      ...nativeDependencies,
    })).rejects.toMatchObject({ code: "TOKEN_EXCHANGE_FAILED" });
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
