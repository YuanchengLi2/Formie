export type AuthCallback =
  | { kind: "code"; code: string }
  | { kind: "error"; message: string };

function callbackPath(url: URL): boolean {
  if (url.protocol === "form:" && url.hostname === "auth" && url.pathname === "/callback") return true;
  return url.pathname.endsWith("/auth/callback");
}

export function parseAuthCallbackUrl(value: string): AuthCallback | null {
  try {
    const url = new URL(value);
    if (!callbackPath(url)) return null;
    if (url.searchParams.get("error") || url.searchParams.get("error_code")) {
      return { kind: "error", message: url.searchParams.get("error_description") || "Sign in could not be completed." };
    }
    const code = url.searchParams.get("code");
    return code ? { kind: "code", code } : null;
  } catch {
    return null;
  }
}
