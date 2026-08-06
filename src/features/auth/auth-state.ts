export type AuthPhase = "initializing" | "signed_out" | "authenticated";

export type AuthSessionSnapshot = { isAnonymous: boolean };

export function deriveAuthPhase(input: {
  initializing: boolean;
  session: AuthSessionSnapshot | null;
}): AuthPhase {
  if (input.initializing) return "initializing";
  if (!input.session || input.session.isAnonymous) return "signed_out";
  return "authenticated";
}
