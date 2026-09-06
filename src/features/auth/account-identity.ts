import type { User } from "@supabase/supabase-js";

export type AccountIdentityPresentation = {
  provider: "apple" | "email";
  title: string;
  detail: string | null;
  usesPrivateRelay: boolean;
};

function hasAppleProvider(user: User): boolean {
  if (user.app_metadata?.provider === "apple") return true;
  if (Array.isArray(user.app_metadata?.providers) && user.app_metadata.providers.includes("apple")) return true;
  return Boolean(user.identities?.some((identity) => identity.provider === "apple"));
}

function normalizedEmail(user: User): string | null {
  const value = user.email?.trim().toLowerCase();
  return value && /^[^@\s]+@[^@\s]+$/.test(value) ? value : null;
}

export function presentAccountIdentity(user: User): AccountIdentityPresentation {
  const email = normalizedEmail(user);
  const usesPrivateRelay = Boolean(email?.endsWith("@privaterelay.appleid.com"));
  const provider = hasAppleProvider(user) || usesPrivateRelay ? "apple" : "email";

  if (provider === "apple") {
    return {
      provider,
      title: "Sign in with Apple",
      detail: usesPrivateRelay ? "Private Relay email" : email,
      usesPrivateRelay,
    };
  }

  return {
    provider,
    title: "Email account",
    detail: email,
    usesPrivateRelay: false,
  };
}
