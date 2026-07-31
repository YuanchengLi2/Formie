export type AuthPhase =
  | "initializing"
  | "signed_out"
  | "verification_pending"
  | "password_recovery"
  | "authenticated";

export type AuthSessionSnapshot = {
  isAnonymous: boolean;
  emailVerified: boolean;
};

export function deriveAuthPhase(input: {
  initializing: boolean;
  session: AuthSessionSnapshot | null;
  pendingVerificationEmail?: string | null;
  recoveryMode?: boolean;
}): AuthPhase {
  if (input.initializing) return "initializing";
  if (input.recoveryMode && input.session) return "password_recovery";
  if (input.pendingVerificationEmail) return "verification_pending";
  if (!input.session) return "signed_out";
  if (input.session.isAnonymous) return "signed_out";
  if (!input.session.emailVerified) return "verification_pending";
  return "authenticated";
}
