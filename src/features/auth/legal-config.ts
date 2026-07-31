export type LegalLinks = {
  termsUrl: string;
  privacyUrl: string;
};

function requirePublicUrl(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is not configured`);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid public URL`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`${name} must use http or https`);
  }
  return parsed.toString().replace(/\/$/, "");
}

export function legalLinksFromEnvironment(environment: Record<string, string | undefined>): LegalLinks {
  return {
    termsUrl: requirePublicUrl(environment.EXPO_PUBLIC_TERMS_URL, "EXPO_PUBLIC_TERMS_URL"),
    privacyUrl: requirePublicUrl(environment.EXPO_PUBLIC_PRIVACY_URL, "EXPO_PUBLIC_PRIVACY_URL"),
  };
}

export function getLegalLinks(): LegalLinks {
  return legalLinksFromEnvironment({
    EXPO_PUBLIC_TERMS_URL: process.env.EXPO_PUBLIC_TERMS_URL ?? "https://useformie.com/terms",
    EXPO_PUBLIC_PRIVACY_URL: process.env.EXPO_PUBLIC_PRIVACY_URL ?? "https://useformie.com/privacy",
  });
}
