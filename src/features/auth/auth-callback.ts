export type AuthCallback =
  | { kind: "session"; accessToken: string; refreshToken: string; flow: "verification" | "recovery" }
  | { kind: "code"; code: string; flow: "verification" | "recovery" }
  | { kind: "otp"; tokenHash: string; otpType: "email" | "recovery" | "signup" | "email_change"; flow: "verification" | "recovery" }
  | { kind: "error"; message: string };

function callbackPath(url: URL): boolean {
  if (url.protocol === "form:" && url.hostname === "auth" && url.pathname === "/callback") return true;
  return url.pathname.endsWith("/auth/callback");
}

export function parseAuthCallbackUrl(value: string): AuthCallback | null {
  try {
    const url = new URL(value);
    if (!callbackPath(url)) return null;
    const params = new URLSearchParams(url.search);
    const hash = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
    hash.forEach((entry, key) => {
      if (!params.has(key)) params.set(key, entry);
    });

    if (params.get("error") || params.get("error_code")) {
      return { kind: "error", message: "This email link is invalid or has expired." };
    }

    const type = params.get("type");
    const flow = type === "recovery" ? "recovery" : "verification";
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (accessToken && refreshToken) return { kind: "session", accessToken, refreshToken, flow };

    const code = params.get("code");
    if (code) return { kind: "code", code, flow };

    const tokenHash = params.get("token_hash");
    if (tokenHash) {
      const otpType = type === "recovery" || type === "signup" || type === "email_change" ? type : "email";
      return { kind: "otp", tokenHash, otpType, flow };
    }
    return null;
  } catch {
    return null;
  }
}
