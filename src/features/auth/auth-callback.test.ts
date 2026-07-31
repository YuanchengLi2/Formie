import { parseAuthCallbackUrl } from "./auth-callback";

describe("parseAuthCallbackUrl", () => {
  it("accepts a FORM verification callback carrying a session", () => {
    expect(parseAuthCallbackUrl("form://auth/callback#access_token=access&refresh_token=refresh&type=signup")).toEqual({
      kind: "session",
      accessToken: "access",
      refreshToken: "refresh",
      flow: "verification",
    });
  });

  it("recognizes recovery callbacks and Expo development callback paths", () => {
    expect(parseAuthCallbackUrl("exp://127.0.0.1:8081/--/auth/callback?code=pkce-code&type=recovery")).toEqual({
      kind: "code",
      code: "pkce-code",
      flow: "recovery",
    });
  });

  it("supports token-hash email callbacks", () => {
    expect(parseAuthCallbackUrl("form://auth/callback?token_hash=hash&type=email")).toEqual({
      kind: "otp",
      tokenHash: "hash",
      otpType: "email",
      flow: "verification",
    });
  });

  it("returns safe callback failures without accepting unrelated URLs", () => {
    expect(parseAuthCallbackUrl("form://auth/callback#error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired")).toEqual({
      kind: "error",
      message: "This email link is invalid or has expired.",
    });
    expect(parseAuthCallbackUrl("form://results/session-id#access_token=access&refresh_token=refresh")).toBeNull();
    expect(parseAuthCallbackUrl("not a url")).toBeNull();
  });
});
