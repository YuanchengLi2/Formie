export type WebsiteOAuthProvider = "apple" | "google";

type OAuthStarter = {
  auth: {
    signInWithOAuth(options: {
      provider: WebsiteOAuthProvider;
      options: { redirectTo: string; skipBrowserRedirect: boolean };
    }): Promise<{ data: { url: string | null }; error: Error | null }>;
  };
};

export async function beginWebsiteOAuth(
  client: OAuthStarter,
  provider: WebsiteOAuthProvider,
  origin: string,
) {
  const redirectTo = new URL("/auth/callback?next=/manage-subscription", origin).toString();
  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });

  if (error) throw error;

  let authorizationUrl: URL;
  try {
    authorizationUrl = new URL(data.url ?? "");
  } catch {
    throw new Error("The provider did not return an authorization URL.");
  }
  if (authorizationUrl.protocol !== "https:") {
    throw new Error("The provider did not return a secure authorization URL.");
  }
  return authorizationUrl.toString();
}
