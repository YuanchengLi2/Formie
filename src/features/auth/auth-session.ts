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
  };
}

export type RemoteUserValidation = "invalid_session" | "transient";

export async function withRemoteValidationDeadline<Value>(request: Promise<Value>, timeoutMs = 10_000): Promise<Value> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(Object.assign(new Error("Remote session validation timed out."), { code: "validation_timeout" })), timeoutMs);
  });
  try {
    return await Promise.race([request, deadline]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function classifyRemoteUserValidationError(error: unknown): RemoteUserValidation {
  const candidate = error as { status?: unknown; code?: unknown; message?: unknown } | null;
  const status = typeof candidate?.status === "number" ? candidate.status : null;
  const code = typeof candidate?.code === "string" ? candidate.code.toLowerCase() : "";
  const message = typeof candidate?.message === "string" ? candidate.message.toLowerCase() : "";
  const explicitlyMissing = code === "user_not_found" || /user.*(?:does not exist|not found)|invalid.*user|revoked.*session/.test(message);
  return explicitlyMissing && (status === 401 || status === 403) ? "invalid_session" : "transient";
}
