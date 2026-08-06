import { parseAuthCallbackUrl } from "./auth-callback";

describe("parseAuthCallbackUrl", () => {
  it("accepts PKCE callbacks for production and Expo development URLs", () => {
    expect(parseAuthCallbackUrl("form://auth/callback?code=production-code")).toEqual({ kind: "code", code: "production-code" });
    expect(parseAuthCallbackUrl("exp://127.0.0.1:8081/--/auth/callback?code=development-code")).toEqual({ kind: "code", code: "development-code" });
  });

  it("returns provider errors without accepting unrelated links", () => {
    expect(parseAuthCallbackUrl("form://auth/callback?error=access_denied&error_description=Access%20denied")).toEqual({
      kind: "error",
      message: "Access denied",
    });
    expect(parseAuthCallbackUrl("form://profile?code=stolen")).toBeNull();
    expect(parseAuthCallbackUrl("not-a-url")).toBeNull();
  });

  it("does not accept obsolete implicit-token or email-OTP callbacks", () => {
    expect(parseAuthCallbackUrl("form://auth/callback#access_token=access&refresh_token=refresh")).toBeNull();
    expect(parseAuthCallbackUrl("form://auth/callback?token_hash=hash&type=email")).toBeNull();
  });
});
