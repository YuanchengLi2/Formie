import { launchOAuth } from "./oauth-launch";

describe("launchOAuth", () => {
  it("uses a full-page redirect on web so the PKCE callback returns to the app", async () => {
    const navigate = jest.fn();
    const openAuthSession = jest.fn();

    await expect(launchOAuth({
      platform: "web",
      providerUrl: "https://accounts.google.test",
      redirectUrl: "https://app.test/auth/callback",
      navigate,
      openAuthSession,
    })).resolves.toEqual({ kind: "redirected" });

    expect(navigate).toHaveBeenCalledWith("https://accounts.google.test");
    expect(openAuthSession).not.toHaveBeenCalled();
  });

  it("keeps the native auth session and returns its callback URL", async () => {
    const openAuthSession = jest.fn().mockResolvedValue({ type: "success", url: "form://auth/callback?code=pkce" });

    await expect(launchOAuth({
      platform: "ios",
      providerUrl: "https://accounts.google.test",
      redirectUrl: "form://auth/callback",
      navigate: jest.fn(),
      openAuthSession,
    })).resolves.toEqual({ kind: "callback", url: "form://auth/callback?code=pkce" });
  });
});
