type AuthSessionResult = { type: string; url?: string };

export type OAuthLaunchResult =
  | { kind: "redirected" }
  | { kind: "callback"; url: string }
  | { kind: "cancelled" };

export async function launchOAuth({
  platform,
  providerUrl,
  redirectUrl,
  navigate,
  openAuthSession,
}: {
  platform: string;
  providerUrl: string;
  redirectUrl: string;
  navigate: (url: string) => void;
  openAuthSession: (url: string, redirectUrl: string) => Promise<AuthSessionResult>;
}): Promise<OAuthLaunchResult> {
  if (platform === "web") {
    navigate(providerUrl);
    return { kind: "redirected" };
  }

  const result = await openAuthSession(providerUrl, redirectUrl);
  if (result.type === "success" && result.url) return { kind: "callback", url: result.url };
  return { kind: "cancelled" };
}
