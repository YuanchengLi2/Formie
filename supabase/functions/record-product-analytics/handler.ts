export type AnalyticsEventInput = {
  clientEventId: string;
  eventName: string;
  occurredAt: string;
  appSessionId: string;
  captureFlowId?: string | null;
  analysisSessionId?: string | null;
  properties?: Record<string, unknown>;
};

export type AnalyticsDependencies = {
  authenticateOptional: (request: Request) => Promise<string | null>;
  ingest: (input: { userId: string | null; anonymousId: string; installationSecret: string; events: AnalyticsEventInput[]; request: Request }) => Promise<string[]>;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const secret = /^[A-Za-z0-9_-]{32,128}$/;

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

export async function recordProductAnalyticsHandler(request: Request, dependencies: AnalyticsDependencies): Promise<Response> {
  if (request.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED" }, 405);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ code: "INVALID_BODY" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ code: "INVALID_BODY" }, 400);
  const row = body as Record<string, unknown>;
  if (Object.keys(row).some((key) => !["anonymousId", "installationSecret", "events"].includes(key))) return json({ code: "INVALID_BODY" }, 400);
  if (typeof row.anonymousId !== "string" || !uuid.test(row.anonymousId) || typeof row.installationSecret !== "string" || !secret.test(row.installationSecret) || !Array.isArray(row.events) || row.events.length < 1 || row.events.length > 25) return json({ code: "INVALID_BODY" }, 400);
  try {
    const userId = await dependencies.authenticateOptional(request);
    const accepted = await dependencies.ingest({ userId, anonymousId: row.anonymousId, installationSecret: row.installationSecret, events: row.events as AnalyticsEventInput[], request });
    return json({ accepted }, 202);
  } catch (error) {
    const message = error instanceof Error ? error.message : "ANALYTICS_INGEST_FAILED";
    if (message === "UNAUTHORIZED") return json({ code: "UNAUTHORIZED" }, 401);
    if (message.includes("RATE_LIMIT")) return json({ code: "RATE_LIMITED" }, 429);
    if (message.includes("INVALID_") || message.includes("CONFLICT") || message.includes("MISMATCH")) return json({ code: message.match(/[A-Z][A-Z0-9_]+/)?.[0] ?? "INVALID_EVENT" }, 400);
    return json({ code: "ANALYTICS_INGEST_FAILED" }, 503);
  }
}
