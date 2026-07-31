import type { AuthSessionSnapshot } from "./auth-state";

type SessionLike = {
  user: {
    is_anonymous?: boolean;
    email_confirmed_at?: string | null;
    confirmed_at?: string | null;
    user_metadata?: Record<string, unknown>;
  };
};

export function authSnapshotFromSession(session: SessionLike | null): AuthSessionSnapshot | null {
  if (!session) return null;
  return {
    isAnonymous: session.user.is_anonymous === true,
    emailVerified: Boolean(session.user.email_confirmed_at ?? session.user.confirmed_at),
  };
}
