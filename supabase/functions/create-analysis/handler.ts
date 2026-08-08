import { parseSetDeclaration, type SetDeclaration } from "../_shared/set-declaration.ts";

type CreatedSession = {
  id: string;
  userId: string;
  previousSessionId: string | null;
};

type CreditReservation = {
  reservationId: string | null;
  status: "reserved" | "already_reserved" | "analysis_pending";
  remaining: number | null;
  periodEndsAt: string | null;
  blockingSessionId?: string | null;
};

export type CreateAnalysisDependencies = {
  authenticate: (request: Request) => Promise<string>;
  ownsSession: (sessionId: string, userId: string) => Promise<boolean>;
  findCatalogExercise: (exerciseId: number) => Promise<{ id: number; name: string } | null>;
  createSession: (input: { userId: string; previousSessionId: string | null; clientRequestId: string | null; declaration: SetDeclaration }) => Promise<CreatedSession>;
  reserveCredit?: (input: { userId: string; clientRequestId: string; kind: "analysis" }) => Promise<CreditReservation>;
  attachCredit?: (reservationId: string, sessionId: string) => Promise<void>;
  cancelCredit?: (userId: string, reservationId: string) => Promise<void>;
  createSignedUpload: (path: string, options: { upsert: boolean }) => Promise<{ signedUrl: string; token: string; path: string }>;
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

export function supportsUpperBodyPrivacyFallback(label: string): boolean {
  const normalized = label.toLowerCase();
  if (/\bleg press\b/.test(normalized)) return false;
  return /\b(bench|chest|shoulder|overhead|military|arnold|press|row|curl|fly|raise|pulldown|pull[- ]?up|triceps|skull ?crusher)\b/.test(normalized);
}

export async function createAnalysisHandler(request: Request, dependencies: CreateAnalysisDependencies): Promise<Response> {
  if (request.method !== "POST") return json({ message: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ message: "A JSON request body is required", code: "INVALID_BODY" }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ message: "Invalid request body", code: "INVALID_BODY" }, 400);
  const keys = Object.keys(body);
  if (keys.some((key) => key !== "previousSessionId" && key !== "clientRequestId" && key !== "declaration" && key !== "privacySafeFallback" && key !== "uploadProfile")) return json({ message: "Invalid request body", code: "INVALID_BODY" }, 400);
  const uploadProfile = (body as Record<string, unknown>).uploadProfile;
  if (uploadProfile !== undefined && uploadProfile !== "single_analysis_v1") {
    return json({ message: "Invalid upload profile", code: "INVALID_BODY" }, 400);
  }
  const privacySafeFallback = (body as Record<string, unknown>).privacySafeFallback;
  if (privacySafeFallback !== undefined && typeof privacySafeFallback !== "boolean") {
    return json({ message: "privacySafeFallback must be a boolean", code: "INVALID_BODY" }, 400);
  }

  const previousSessionId = "previousSessionId" in body ? (body as { previousSessionId?: unknown }).previousSessionId : null;
  if (previousSessionId !== null && previousSessionId !== undefined && typeof previousSessionId !== "string") {
    return json({ message: "previousSessionId must be a string", code: "INVALID_BODY" }, 400);
  }
  const clientRequestId = "clientRequestId" in body ? (body as { clientRequestId?: unknown }).clientRequestId : null;
  if (clientRequestId !== null && clientRequestId !== undefined && (
    typeof clientRequestId !== "string"
    || clientRequestId.trim().length < 8
    || clientRequestId.length > 128
  )) {
    return json({ message: "clientRequestId must be between 8 and 128 characters", code: "INVALID_BODY" }, 400);
  }
  let declaration: SetDeclaration;
  try {
    declaration = parseSetDeclaration((body as Record<string, unknown>).declaration);
  } catch (error) {
    return json({ message: error instanceof Error ? error.message : "Set declaration is invalid", code: "INVALID_BODY" }, 400);
  }

  try {
    const userId = await dependencies.authenticate(request);
    const normalizedPreviousId = previousSessionId || null;
    if (normalizedPreviousId && !(await dependencies.ownsSession(normalizedPreviousId, userId))) {
      return json({ message: "Previous analysis not found", code: "NOT_FOUND" }, 404);
    }
    if (declaration.exercise.source === "catalog") {
      const catalogExercise = await dependencies.findCatalogExercise(declaration.exercise.catalogExerciseId);
      if (!catalogExercise) return json({ message: "Selected exercise is unavailable", code: "INVALID_EXERCISE" }, 400);
      declaration = {
        ...declaration,
      exercise: {
        source: "catalog",
        catalogExerciseId: catalogExercise.id,
        label: catalogExercise.name,
      } as SetDeclaration["exercise"],
      };
    }

    const requestKey = typeof clientRequestId === "string" && clientRequestId.trim()
      ? clientRequestId.trim()
      : `analysis-${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let reservation: CreditReservation | null = null;
    try {
      if (dependencies.reserveCredit) reservation = await dependencies.reserveCredit({ userId, clientRequestId: requestKey, kind: "analysis" });
      if (reservation?.status === "analysis_pending") {
        return json({ message: "An analysis is already in progress", code: "ANALYSIS_PENDING", sessionId: reservation.blockingSessionId, remaining: reservation.remaining, periodEndsAt: reservation.periodEndsAt }, 409);
      }
      const session = await dependencies.createSession({
        userId,
        previousSessionId: normalizedPreviousId,
        clientRequestId: typeof clientRequestId === "string" ? clientRequestId.trim() : dependencies.reserveCredit ? requestKey : null,
        declaration,
      });
      if (reservation?.reservationId && dependencies.attachCredit) await dependencies.attachCredit(reservation.reservationId, session.id);
      const shouldCreateFallback = privacySafeFallback === true
        && supportsUpperBodyPrivacyFallback(declaration.exercise.label);
      if (uploadProfile === "single_analysis_v1") {
        const analysisUpload = await dependencies.createSignedUpload(`${userId}/${session.id}/analysis-input.mp4`, { upsert: false });
        return json({ sessionId: session.id, reservationId: reservation?.reservationId, remaining: reservation?.remaining, periodEndsAt: reservation?.periodEndsAt, analysisUpload }, 201);
      }
      const [upload, analysisUpload, privacySafeUpload] = await Promise.all([
        dependencies.createSignedUpload(`${userId}/${session.id}/original.mp4`, { upsert: false }),
        dependencies.createSignedUpload(`${userId}/${session.id}/analysis-input.mp4`, { upsert: false }),
        shouldCreateFallback
          ? dependencies.createSignedUpload(`${userId}/${session.id}/privacy-safe-upper-body.mp4`, { upsert: false })
          : Promise.resolve(null),
      ]);
      return json({
        sessionId: session.id,
        reservationId: reservation?.reservationId,
        remaining: reservation?.remaining,
        periodEndsAt: reservation?.periodEndsAt,
        upload,
        analysisUpload,
        ...(privacySafeUpload ? { privacySafeUpload } : {}),
      }, 201);
    } catch (error) {
      if (reservation?.reservationId && dependencies.cancelCredit) await dependencies.cancelCredit(userId, reservation.reservationId).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return json({ message: "Sign in again", code: "UNAUTHORIZED" }, 401);
    if (error && typeof error === "object" && "code" in error && String((error as { code?: unknown }).code).startsWith("ANALYSIS_")) {
      return json({ message: error instanceof Error ? error.message : "Analysis access is unavailable", code: String((error as { code?: unknown }).code) }, 402);
    }
    return json({ message: "Analysis session could not be created", code: "CREATE_FAILED" }, 500);
  }
}
